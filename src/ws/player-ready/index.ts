import arc from "@architect/functions";
import type { GameSession } from "@shared/types/GameSession";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import { getGameSession, updateGameSession } from "shared/game-sessions";
import { getPlayableStory } from "shared/ink-run";
import { wrap_ws } from "shared/wrap";
import { z } from "zod";

const PlayerReadySchema = z.object({
	sessionId: z.string(),
	character: z.object({
		userId: z.string(),
		id: z.string().uuid(),
		name: z.string().min(1, "Character name is required"),
		avatar: z.string(),
	}),
	role: z.object({
		tag: z.string(),
	}),
});

function verifyAgreeOnVote(session: GameSession): boolean {
	const gamemode = session.data?.ink?.metadata?.gamemode;
	if (!gamemode) return false;

	if (gamemode === "each-player-have-role") {
		return Object.keys(session.data.roles_player).every((key) => {
			return session.data.roles_player[key] !== -1;
		});
	}
	if (gamemode === "no-roles") {
		for (const player of session.players) {
			if (!player?.data?.avatar || !player?.data?.character_name) return false;
		}
		return true;
	}
	return false;
}

export const main = async (
	event: APIGatewayProxyWebsocketEventV2,
	context: Context,
): Promise<APIGatewayProxyResultV2> => {
	const connectionId = event.requestContext.connectionId;
	const { sessionId, character, role } = PlayerReadySchema.parse(
		JSON.parse(event.body),
	);

	const session = await getGameSession(sessionId);
	let playerIndex = undefined;
	const player = session.players.find((p, ind) => {
		if (p.socketId === connectionId) {
			playerIndex = ind;
			return true;
		}
		return false;
	});
	if (!player || playerIndex === undefined) {
		return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
	}

	if (!session.players[playerIndex]?.data)
		session.players[playerIndex].data = {};
	session.players[playerIndex].data.avatar = character.avatar;
	session.players[playerIndex].data.character_name = character.name;
	session.players[playerIndex].data.character_id = character.id;
	session.data.roles_player[role?.tag] = playerIndex;

	// first save
	await updateGameSession(session);

	const agreement = verifyAgreeOnVote(session);
	if (agreement) {
		await Promise.allSettled(
			session.players.map((p) => {
				return arc.ws.send({
					id: p.socketId,
					payload: JSON.stringify({
						action: "game-running",
						session: session,
					}),
				});
			}),
		);

		const ink = await getPlayableStory(session.data.ink.id);
		const ink_data = ink.runLines();
		// set ink.state after game-running message, so state is not sent to players (big and useless for them)
		session.data.ink.state = ink.status;
		await updateGameSession(session);

		await Promise.allSettled(
			session.players.map((p) => {
				return arc.ws.send({
					id: p.socketId,
					payload: JSON.stringify({
						action: "game-continue",
						ink_data,
					}),
				});
			}),
		);
	} else {
		await Promise.allSettled(
			session.players.map((p) => {
				return arc.ws.send({
					id: p.socketId,
					payload: JSON.stringify({
						action: "player-ready",
						player: session.players[playerIndex],
						role,
					}),
				});
			}),
		);
	}

	return { statusCode: 200 };
};

export const handler = wrap_ws(main);
