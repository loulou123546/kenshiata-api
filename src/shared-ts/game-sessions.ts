import arc from "@architect/functions";
import type { GameRoom } from "@shared/types/GameRoom";
import { GameSession, UserGameSession } from "@shared/types/GameSession";
import { uuidv7 } from "uuidv7";
import grafana from "./grafana";
import { getIdentityByUserId } from "./sockets";

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

export async function setUserJoinedGameSession(
	userId: string,
	sessionId: string,
	character_id: string,
	name: string,
): Promise<UserGameSession> {
	const client = (await arc.tables()).userGameSessions;

	// if not exist, set last_joined and first_joined to new Date().toISOString()
	// if exist, update last_joined to new Date().toISOString()
	const res = await client.update({
		Key: {
			userId: userId,
			sessionId: sessionId,
		},
		// @ts-ignore UpdateExpression is well defined in docs
		UpdateExpression:
			"SET last_joined = :now, characterId = :character_id, sessionName = :sname, first_joined = if_not_exists(first_joined, :now)",
		ExpressionAttributeValues: {
			":now": new Date().toISOString(),
			":character_id": character_id,
			":sname": name,
		},
		ReturnValues: "ALL_NEW",
	});
	return UserGameSession.parse(res?.Attributes);
}

export async function getUserGameSessions(
	userId: string,
): Promise<UserGameSession[]> {
	const sessions = [];
	try {
		const client = (await arc.tables()).userGameSessions;
		const raw = await client.query({
			KeyConditionExpression: "userId = :userId",
			ExpressionAttributeValues: {
				":userId": userId,
			},
		});
		for (const item of raw.Items) {
			sessions.push(UserGameSession.parse(item));
		}
	} catch (err) {
		grafana.recordException(err);
	}
	return sessions;
}

export async function deleteUserGameSession(
	userId: string,
	sessionId: string,
): Promise<void> {
	const client = (await arc.tables()).userGameSessions;
	await client.delete({ userId, sessionId });
}
