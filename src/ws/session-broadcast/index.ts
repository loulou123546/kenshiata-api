import arc from "@architect/functions";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import { getGameSession } from "shared/game-sessions";
import grafana from "shared/grafana";
import { wrap_ws } from "shared/wrap";
import { z } from "zod";

const BroadcastSchema = z.object({
	sessionId: z.string(),
	internal_action: z.string(),
	internal_payload: z.any(),
});

export const main = async (
	event: APIGatewayProxyWebsocketEventV2,
	context: Context,
): Promise<APIGatewayProxyResultV2> => {
	const connectionId = event.requestContext.connectionId;
	const { sessionId, internal_action, internal_payload } =
		BroadcastSchema.parse(JSON.parse(event.body));

	const session = await getGameSession(sessionId);
	if (!session.players.some((p) => p.socketId === connectionId)) {
		return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
	}

	await Promise.allSettled(
		session.players.map((p) => {
			if (p.socketId === connectionId) return Promise.resolve();
			return arc.ws
				.send({
					id: p.socketId,
					payload: JSON.stringify({
						action: internal_action,
						...internal_payload,
					}),
				})
				.catch((err) => {
					grafana.recordException(err);
				});
		}),
	);
	return { statusCode: 200 };
};

export const handler = wrap_ws(main);
