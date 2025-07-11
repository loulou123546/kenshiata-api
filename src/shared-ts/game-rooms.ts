import { z } from 'zod';
import arc from '@architect/functions';
import { broadcastToUsers, broadcastAllSockets } from './sockets';

export const GameRoom = z.object({
    hostId: z.string().uuid(),
    players: z.array(z.string().uuid()),
    invites: z.array(z.string().uuid()),
    public: z.boolean(),
    name: z.string().min(1).max(256),
});
export type GameRoom = z.infer<typeof GameRoom>;

export async function createGameRoom(userId: string, is_public: boolean, name: string): Promise<GameRoom> {
    const client = (await arc.tables()).gameRooms;
    const room = GameRoom.parse({
        hostId: userId, players: [userId], invites: [], public: is_public, name
    })
    await client.put(room);
    return room;
}

export async function listAvailableGameRooms(userId: string | undefined = undefined): Promise<GameRoom[]> {
    const client = (await arc.tables()).gameRooms;
    const rooms = (await client.scan()).Items || [];
    if (!userId) {
        return rooms.filter(room => room.public);
    }
    // Filter rooms where the user is either a player or has an invite
    return rooms.filter(room => 
        room.public || 
        room.players.includes(userId) || 
        room.invites.includes(userId)
    );
}

export async function getGameRoomById(hostId: string): Promise<GameRoom> {
    const client = (await arc.tables()).gameRooms;
    const room = await client.get({ hostId });
    if (!room) {
        throw new Error(`Game room with ID ${hostId} not found`);
    }
    return GameRoom.parse(room);
}

export async function updateGameRoom(room: GameRoom): Promise<GameRoom> {
    const client = (await arc.tables()).gameRooms;
    await client.put(room);
    return room;
}

export async function broadcastToGameRoom(room: GameRoom, action: string, payload: any): Promise<void> {
    const allUserIds = [...new Set([room.hostId, ...room.players, ...room.invites])];
    await broadcastToUsers(allUserIds, { action, payload });
}

export async function deleteGameRoom (hostId: string, sendNotification: boolean = false): Promise<void> {
    const client = (await arc.tables()).gameRooms;
    await client.delete({ hostId: hostId });
    if (sendNotification) {
        await broadcastAllSockets({
            action: "update-game-rooms",
            updateRooms: [],
            removedRooms: [hostId]
        });
    }
}
