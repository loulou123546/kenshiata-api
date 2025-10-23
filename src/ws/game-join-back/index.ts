import arc from "@architect/functions";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import {
	getGameSession,
	setUserJoinedGameSession,
	updateGameSession,
} from "shared/game-sessions";
import grafana from "shared/grafana";
import { getPlayableStory } from "shared/ink-run";
import { getIdentityBySocketId, setGameSessionToUser } from "shared/sockets";
import { wrap_ws } from "shared/wrap";
import { z } from "zod";

const PlayerJoinBack = z.object({
	sessionId: z.string(),
});

export const main = async (
	event: APIGatewayProxyWebsocketEventV2,
	_context: Context,
): Promise<APIGatewayProxyResultV2> => {
	const connectionId = event.requestContext.connectionId;
	const { sessionId } = PlayerJoinBack.parse(JSON.parse(event.body));

	const user = await getIdentityBySocketId(connectionId);

	const session = await getGameSession(sessionId);
	let playerIndex = undefined;
	const player = session.players.find((p, ind) => {
		if (p.userId === user.user.id) {
			playerIndex = ind;
			return true;
		}
		return false;
	});
	if (!player || playerIndex === undefined) {
		return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
	}

	if (!session.players[playerIndex]?.data)
		return {
			statusCode: 404,
			body: JSON.stringify({ error: "Missing data for your account" }),
		};

	session.players[playerIndex].socketId = connectionId;

	// save updated socket ID
	await updateGameSession(session);

	// start game for user
	await arc.ws.send({
		id: connectionId,
		payload: JSON.stringify({
			action: "join-running-game",
			session: session,
		}),
	});

	// refresh data (in fact socketId) for all users
	await Promise.allSettled(
		session.players.flatMap((p) => {
			// skip actual joining user
			if (p.socketId === connectionId) return [];
			return [
				arc.ws.send({
					id: p.socketId,
					payload: JSON.stringify({
						action: "update-player",
						player: session.players[playerIndex],
					}),
				}),
				arc.ws.send({
					id: p.socketId,
					payload: JSON.stringify({
						action: "player-join-left",
						join: true,
						name: `${session.players[playerIndex].username} (${session.players[playerIndex].data.character_name})`,
					}),
				}),
			];
		}),
	);

	await setGameSessionToUser(user.user.id, connectionId, session.id).catch(
		(err) => {
			grafana.recordException(err);
		},
	);

	const ink = await getPlayableStory(session.data.ink.id);
	if (session.data.ink?.state) ink.status = session.data.ink.state;

	// this contain only partial data : ie. choices but not last lines of texts
	const ink_data = ink.runLines();

	await arc.ws.send({
		id: connectionId,
		payload: JSON.stringify({
			action: "game-continue",
			ink_data: {
				choices: ink_data.choices,
				lines: session.data.ink.last_texts,
			},
		}),
	});

	// refresh last joined date for this user
	await setUserJoinedGameSession(
		user.user.id,
		session.id,
		session.players[playerIndex].data.character_id,
		session.name,
	).catch((err) => {
		grafana.recordException(err);
	});

	return { statusCode: 200 };
};

export const handler = wrap_ws(main);
