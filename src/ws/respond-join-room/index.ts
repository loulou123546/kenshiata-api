import { Context, APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import { broadcastAllSockets, getIdentityBySocketId, getIdentityByUserId } from 'shared/sockets';
import { getGameRoomById, updateGameRoom } from 'shared/game-rooms';
import { z } from 'zod';
import arc from '@architect/functions';

const JoinSchema = z.object({
  hostId: z.string().uuid(),
  userId: z.string().uuid(),
  accept: z.boolean(),
});

export const handler = async (event: APIGatewayProxyWebsocketEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
  const connectionId = event.requestContext.connectionId;
  try {
    const {hostId, userId, accept} = JoinSchema.parse(JSON.parse(event.body));

    const requestFrom = await getIdentityBySocketId(connectionId);
    if (requestFrom.user.id !== hostId || requestFrom.socketId !== connectionId) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
    }
    const target = await getIdentityByUserId(userId);
    const room = await getGameRoomById(hostId);

    await arc.ws.send({
      id: target.socketId,
      payload: JSON.stringify({
        action: "respond-join-room",
        hostId,
        accept
      })
    })

    if (!accept) {
      return { statusCode: 200 };
    }

    const uptodate_room = await updateGameRoom({...room, players: [... new Set([...room.players, userId])]});
    await broadcastAllSockets({
      action:'update-game-rooms',
      updateRooms: [uptodate_room]
    });

    return { statusCode: 200 };

  } catch (error) {
    console.error('Error processing request:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) }
  }
}
