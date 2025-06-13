import { Context, APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import arc from '@architect/functions';

export const handler = async (event: APIGatewayProxyWebsocketEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
  const connectionId = event.requestContext.connectionId;
  const userdata = JSON.parse(event.body).user;

  const players = (await arc.tables()).playersOnline;
  const sockets = (await arc.tables()).sockets;

  try {
    await sockets.put({ socketId: connectionId, ...userdata });
    await players.put({ socketId: connectionId, ...userdata });
    await arc.ws.send({ id: connectionId, payload: { action: "whoami", socketId: connectionId } });
  }
  catch (e) {
    console.error(e);
    await arc.ws.close({ id: connectionId })
  }
  return { statusCode: 200 };
}
