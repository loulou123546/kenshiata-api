import { Context, APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import { getIdentityBySocketId, broadcastAllSockets } from 'shared/sockets';
import { listAvailableGameRooms } from 'shared/game-rooms';
import arc from '@architect/functions';


export const handler = async (event: APIGatewayProxyWebsocketEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
  const connectionId = event.requestContext.connectionId;
  try {
    const identity = await getIdentityBySocketId(connectionId);
    const rooms = await listAvailableGameRooms(identity.user.id);
    await arc.ws.send({
      id: connectionId,
      payload: JSON.stringify({
        action: "update-game-rooms",
        updateRooms: rooms
      })
    });
    return { statusCode: 200 }

  } catch (error) {
    console.error('Error processing request:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal Server Error' }) }
  }
}
