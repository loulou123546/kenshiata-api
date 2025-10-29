import arc from "@architect/functions";
import type { GameSession } from "@shared/types/GameSession";
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
				return arc.ws
					.send({
						id: p.socketId,
						payload: JSON.stringify({
							action: "game-running",
							session: session,
						}),
					})
					.catch((err) => {
						grafana.recordException(err);
					});
			}),
		);

		const ink = await getPlayableStory(session.data.ink.id);

		const names = session.players.map((player) => player.data.character_name);
		ink.setVariable("NB_PLAYERS", names.length);
		if (names.length <= 1) {
			ink.setVariable("REAL_NAMES", names.join(", ")); // should be only one, so join() is not used
		} else {
			const last = names.pop();
			ink.setVariable("REAL_NAMES", `${names.join(", ")} et ${last}`);
		}
		const ink_data = ink.runLines();
		// set ink.state after game-running message, so state is not sent to players (big and useless for them)
		session.data.ink.state = ink.status;
		session.data.ink.last_texts = [
			...(session.data.ink.last_texts ?? []),
			...ink_data.lines,
		];
		while (session.data.ink.last_texts.length > 15) {
			session.data.ink.last_texts.shift();
		}
		await updateGameSession(session);

		await Promise.allSettled(
			session.players.map((p) => {
				return arc.ws
					.send({
						id: p.socketId,
						payload: JSON.stringify({
							action: "game-continue",
							ink_data,
						}),
					})
					.catch((err) => {
						grafana.recordException(err);
					});
			}),
		);

		// register this new gameSession to each player
		await Promise.allSettled(
			session.players.map((p) => {
				return setUserJoinedGameSession(
					p.userId,
					session.id,
					p.data.character_id,
					session.name,
				).catch((err) => {
					grafana.recordException(err);
				});
			}),
		);
	} else {
		await Promise.allSettled(
			session.players.map((p) => {
				return arc.ws
					.send({
						id: p.socketId,
						payload: JSON.stringify({
							action: "player-ready",
							player: session.players[playerIndex],
							role,
						}),
					})
					.catch((err) => {
						grafana.recordException(err);
					});
			}),
		);
	}

	return { statusCode: 200 };
};

export const handler = wrap_ws(main);
