import { Context, APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import arc from '@architect/functions';

export const handler = async (event: APIGatewayProxyWebsocketEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
  const connectionId = event.requestContext.connectionId;
  const data = JSON.parse(event.body);
  if (data.from.socketId !== connectionId) {
    console.error('Socket ID mismatch:', data.from.socketId, connectionId);
    return { statusCode: 200 };
  }
  arc.ws.send({
    id: data.target.socketId,
    payload: event.body
  });
  return { statusCode: 200 }
}