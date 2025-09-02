import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import grafana from "shared/grafana";
import { associateSocketToUser } from "shared/sockets";
import { wrap_ws } from "shared/wrap";

export const main = async (
	event: APIGatewayProxyWebsocketEventV2,
	context: Context,
): Promise<APIGatewayProxyResultV2> => {
	const connectId = event.requestContext.connectionId;
	// @ts-ignore queryStringParameters is available and documented on AWS
	const qs = event.queryStringParameters;
	const token = qs?.token;
	if (!token) {
		return { statusCode: 401 };
	}
	try {
		await associateSocketToUser(connectId, token);
		return { statusCode: 200 };
	} catch (error) {
		grafana.recordException(error);
		return { statusCode: 401 };
	}
};

export const handler = wrap_ws(main);
