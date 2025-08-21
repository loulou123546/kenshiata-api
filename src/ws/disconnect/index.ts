import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import { closeSocketBySocketId } from "shared/sockets";

export const handler = async (
	event: APIGatewayProxyWebsocketEventV2,
	context: Context,
): Promise<APIGatewayProxyResultV2> => {
	const connectionId = event.requestContext.connectionId;
	try {
		await closeSocketBySocketId(connectionId);
	} catch (e) {
		console.warn(e);
	}
	return { statusCode: 200 };
};
