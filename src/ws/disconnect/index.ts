import { Context, APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'
import { closeSocketBySocketId } from 'shared/sockets';

export const handler = async (event: APIGatewayProxyWebsocketEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
  const connectionId = event.requestContext.connectionId;
  try {
    await closeSocketBySocketId(connectionId);
  }
  finally {
    return { statusCode: 200 }
  }
}
