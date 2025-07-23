import { z } from 'zod';
import arc from '@architect/functions';
import { broadcastToUsers, getIdentityByUserId } from './sockets';
import { uuidv7 } from "uuidv7";
import { GameRoom } from './game-rooms';

export const GameSession = z.object({
    id: z.string().uuid(),
    players: z.array(z.object({
        socketId: z.string(),
        userId: z.string().uuid(),
        username: z.string(),
        data: z.record(z.any()).optional(),
    })),
    name: z.string().min(1).max(256),
    data: z.record(z.any()).optional(),
});
export type GameSession = z.infer<typeof GameSession>;

export async function convertGameRoomToSession(room: GameRoom): Promise<GameSession> {
    const client = (await arc.tables()).gameSessions;
    const players = await Promise.all(room.players.map(async (playerId) => {
        const identity = await getIdentityByUserId(playerId);
        return {
            socketId: identity.socketId,
            userId: identity.user.id,
            username: identity.user.username,
            data: {}
        };
    }));

    const session = GameSession.parse({
        id: uuidv7(),
        players,
        name: room.name,
        data: {}
    })
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

export async function updateGameSession(session: GameSession): Promise<GameSession> {
    const client = (await arc.tables()).gameSessions;
    await client.put(session);
    return session;
}

export async function broadcastToGameSession(session: GameSession, action: string, payload: any): Promise<void> {
    await Promise.all(session.players.map(player =>
        arc.ws.send({
            id: player.socketId,
            payload: JSON.stringify({
                action,
                sessionId: session.id,
                ...payload
            }),
        })
    ));
}

export async function deleteGameSession (id: string): Promise<void> {
    const client = (await arc.tables()).gameSessions;
    await client.delete({ id });
}
