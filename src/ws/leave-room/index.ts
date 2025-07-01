import { Context, APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import { broadcastAllSockets, getIdentityBySocketId } from 'shared/sockets';
import { getGameRoomById, updateGameRoom, deleteGameRoom } from 'shared/game-rooms';
import { z } from 'zod';

const LeaveSchema = z.object({
  hostId: z.string().uuid()
});

export const handler = async (event: APIGatewayProxyWebsocketEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
  const connectionId = event.requestContext.connectionId;
  try {
    const {hostId} = LeaveSchema.parse(JSON.parse(event.body));

    const requestFrom = await getIdentityBySocketId(connectionId);
    if (requestFrom.socketId !== connectionId) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }
    const room = await getGameRoomById(hostId);
    if (!room.players.includes(requestFrom.user.id)) {
        return { statusCode: 200 };
    }

    if (room.hostId !== requestFrom.user.id) {
        const newRoom = await updateGameRoom({
            ...room,
            players: room.players.filter(player => player !== requestFrom.user.id)
        });
        await broadcastAllSockets({
            action:'update-game-rooms',
            updateRooms: [newRoom]
        });
    } else {
        await deleteGameRoom(room.hostId, true);
    }

    return { statusCode: 200 };

  } catch (error) {
    console.error('Error processing request:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) }
  }
}
