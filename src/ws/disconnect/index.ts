import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import { closeSocketBySocketId } from "shared/sockets";
import { wrap_ws } from "shared/wrap";

export const main = async (
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

export const handler = wrap_ws(main);
