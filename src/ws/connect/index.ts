import { Context, APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import { associateSocketToUser } from 'shared/sockets';

export const handler = async (event: APIGatewayProxyWebsocketEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
  const connectId = event["requestContext"]["connectionId"];
  const qs = event['queryStringParameters'];
  const token = qs?.token;
  if (!token) {
    return { statusCode: 401 }
  }
  try {
    await associateSocketToUser(connectId, token);
    return { statusCode: 200 }

  } catch (error) {
    console.error('Error during socket authentication:', error);
    return { statusCode: 401 }
  }
}
