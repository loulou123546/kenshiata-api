import arc from "@architect/functions";
import type { GameRoom } from "@shared/types/GameRoom";
import { uuidv7 } from "uuidv7";
import { getIdentityByUserId } from "./sockets";

import { GameSession } from "@shared/types/GameSession";

export async function convertGameRoomToSession(
	room: GameRoom,
): Promise<GameSession> {
	const client = (await arc.tables()).gameSessions;
	const players = await Promise.all(
		room.players.map(async (playerId) => {
			const identity = await getIdentityByUserId(playerId);
			return {
				socketId: identity.socketId,
				userId: identity.user.id,
				username: identity.user.username,
				data: {},
			};
		}),
	);

	const session = GameSession.parse({
		id: uuidv7(),
		players,
		name: room.name,
		data: {},
	});
	await client.put(session);
	return session;
}

export async function getGameSession(id: string): Promise<GameSession> {
	const client = (await arc.tables()).gameSessions;
	const session = await client.get({ id });
	if (!session) {
		throw new Error(`Game room with ID ${id} not found`);
	}
	return GameSession.parse(session);
}

export async function updateGameSession(
	session: GameSession,
): Promise<GameSession> {
	const client = (await arc.tables()).gameSessions;
	await client.put(session);
	return session;
}

export async function broadcastToGameSession(
	session: GameSession,
	action: string,
	payload: object,
): Promise<void> {
	await Promise.all(
		session.players.map((player) =>
			arc.ws.send({
				id: player.socketId,
				payload: JSON.stringify({
					action,
					sessionId: session.id,
					...payload,
				}),
			}),
		),
	);
}

export async function deleteGameSession(id: string): Promise<void> {
	const client = (await arc.tables()).gameSessions;
	await client.delete({ id });
}
