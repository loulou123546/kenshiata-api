import arc from '@architect/functions';
import { uuidv7 } from "uuidv7";
import { batchGetItems } from './aws-utils';
import { type UserIdentity } from './auth';

export type SocketIdentity = {
    socketId: string;
    user: UserIdentity;
}

export async function initNewSocketAuth(user: UserIdentity): Promise<string> {
    const client = (await arc.tables()).sockets;
    const token = uuidv7();
    const expires = (Date.now() / 1000) + 300; // 5 minutes from now
    await client.put({ id: `setup:${token}`, user, expires });
    return token;
}

export async function associateSocketToUser(socketId: string, setupId: string): Promise<SocketIdentity> {
    const client = (await arc.tables()).sockets;
    const setup = await client.get({ id: `setup:${setupId}` });
    if (!setup) {
        throw new Error('Setup not found');
    }
    if (!setup.user?.id) {
        throw new Error('User ID not found in setup');
    }
    if (!setup.expires || setup.expires < (Date.now() / 1000)) {
        throw new Error('Token expired');
    }
    await client.put({ id: `socket:${socketId}`, user: setup.user });
    await client.put({ id: `user:${setup.user.id}`, socketId, user: setup.user });
    return { user: setup.userId, socketId };
}

export async function getIdentityByUserId(userId: string): Promise<SocketIdentity> {
    const client = (await arc.tables()).sockets;
    const userSocket = await client.get({ id: `user:${userId}` });
    if (!userSocket || !userSocket.socketId) {
        throw new Error('No socket associated with this user');
    }
    return {socketId: userSocket.socketId, user: userSocket.user};
}

export async function getIdentityBySocketId(socketId: string): Promise<SocketIdentity> {
    const client = (await arc.tables()).sockets;
    const socket = await client.get({ id: `socket:${socketId}` });
    if (!socket || !socket.user?.id) {
        throw new Error('No user associated with this socket');
    }
    return {socketId, user: socket.user};
}

export async function closeSocketBySocketId(socketId: string): Promise<void> {
    const client = (await arc.tables()).sockets;
    const socket = await client.get({ id: `socket:${socketId}` });
    if (!socket) {
        throw new Error('Socket not found');
    }
    await client.delete({ id: `socket:${socketId}` });
    if (socket.user?.id) {
        await client.delete({ id: `user:${socket.user.id}`, socketId });
    }
    try {
        await arc.ws.close({id: socketId});
    }
    catch (error) {
        console.error('Error closing socket:', error);
    }
}

export async function closeSocketByUserId(userId: string): Promise<void> {
    const client = (await arc.tables()).sockets;
    const userSocket = await client.get({ id: `user:${userId}` });
    if (!userSocket) {
        throw new Error('No socket associated with this user');
    }
    await client.delete({ id: `user:${userId}` });
    if (userSocket.socketId) {
        await client.delete({ id: `socket:${userSocket.socketId}` });
        try {
            await arc.ws.close({id: userSocket.socketId});
        }
        catch (error) {
            console.error('Error closing socket:', error);
        }
    }
}

export async function broadcastToUsers(userIds: string[], payload: any): Promise<{sent: string[], failed: string[]}> {
    const {results, notProcessed} = await batchGetItems('sockets', userIds.map(userId => ({id: `user:${userId}`})));

    const failed: string[] = [...notProcessed.map(item => item?.id?.replace('user:', ''))];
    const sent: string[] = [];
    await Promise.all(results.map(async userSocket => {
        try {
            await arc.ws.send({
                id: userSocket.socketId,
                payload: JSON.stringify(payload),
            });
            sent.push(userSocket.id.replace('user:', ''));
        }
        catch {
            failed.push(userSocket.id.replace('user:', ''));
        }
    }));
    return { sent, failed };
}

export async function broadcastAllSockets(payload: any): Promise<{sent: string[], failed: string[]}> {
    const client = (await arc.tables()).sockets;
    const sockets = (await client.scan()).Items || [];
    
    const failed: string[] = [];
    const sent: string[] = [];
    
    await Promise.all(sockets.map(async socket => {
        if (socket.id.startsWith('user:')) {
            try {
                await arc.ws.send({
                    id: socket.socketId,
                    payload: JSON.stringify(payload),
                });
                sent.push(socket.id.replace('user:', ''));
            } catch {
                failed.push(socket.id.replace('user:', ''));
            }
        }
    }));
    
    return { sent, failed };
}
