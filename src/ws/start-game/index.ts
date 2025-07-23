import { Context, APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import { broadcastAllSockets, getIdentityBySocketId } from 'shared/sockets';
import { getGameRoomById, updateGameRoom, deleteGameRoom } from 'shared/game-rooms';
import { broadcastToGameSession, convertGameRoomToSession } from 'shared/game-sessions';
import { z } from 'zod';

const StartGameSchema = z.object({
  hostId: z.string().uuid()
});

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export const handler = async (event: APIGatewayProxyWebsocketEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
  const connectionId = event.requestContext.connectionId;
  try {
    const {hostId} = StartGameSchema.parse(JSON.parse(event.body));

    const requestFrom = await getIdentityBySocketId(connectionId);
    if (requestFrom.socketId !== connectionId || hostId !== requestFrom.user.id) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }
    const room = await getGameRoomById(hostId);
    if (!room.players.includes(requestFrom.user.id) || room.hostId !== requestFrom.user.id) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }

    const session = await convertGameRoomToSession(room);
    await broadcastToGameSession(session, 'start-game', {
      hostId,
      ...session
    });

    await delay(1000); // Give a second for client game to process start-game before deleting the room
    await deleteGameRoom(room.hostId, true);

    return { statusCode: 200 };

  } catch (error) {
    console.error('Error processing request:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) }
  }
}
