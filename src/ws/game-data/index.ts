import { Context, APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import arc from '@architect/functions';

export const handler = async (event: APIGatewayProxyWebsocketEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
  const connectionId = event.requestContext.connectionId;
  const data = JSON.parse(event.body);
  // control should be done on data.targetID === other player ID is ok
  await arc.ws.send({
    id: data.targetID,
    payload: event.body
  });
  return { statusCode: 200 }
}