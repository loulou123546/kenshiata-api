import { Context, APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import arc from '@architect/functions';

export const handler = async (event: APIGatewayProxyWebsocketEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
  const connectionId = event.requestContext.connectionId;

  const players = (await arc.tables()).playersOnline;
  const sockets = (await arc.tables()).sockets;
  try {
    const data = await sockets.get({ socketId: connectionId });
    if (!data) {
      return { statusCode: 200 }
    }
    await players.delete({ username: data.username });
    await sockets.delete({ socketId: connectionId });
  }
  finally {
    return { statusCode: 200 }
  }
}