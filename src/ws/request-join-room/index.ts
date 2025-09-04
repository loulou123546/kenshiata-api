import arc from "@architect/functions";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import { getGameRoomById } from "shared/game-rooms";
import grafana from "shared/grafana";
import { getIdentityBySocketId, getIdentityByUserId } from "shared/sockets";
import { wrap_ws } from "shared/wrap";
import { z } from "zod";

const JoinSchema = z.object({
	hostId: z.string().uuid(),
});

export const main = async (
	event: APIGatewayProxyWebsocketEventV2,
	context: Context,
): Promise<APIGatewayProxyResultV2> => {
	const connectionId = event.requestContext.connectionId;
	try {
		const { hostId } = JoinSchema.parse(JSON.parse(event.body));

		const requestFrom = await getIdentityBySocketId(connectionId);
		const room = await getGameRoomById(hostId);

		if (
			!room ||
			(!room.public &&
				!room.players.includes(requestFrom.user.id) &&
				!room.invites.includes(requestFrom.user.id))
		) {
			await arc.ws.send({
				id: connectionId,
				payload: JSON.stringify({
					action: "respond-join-room",
					hostId,
					accept: false,
				}),
			});
			return { statusCode: 200 };
		}

		const hostIdentity = await getIdentityByUserId(room.hostId);

		await arc.ws.send({
			id: hostIdentity.socketId,
			payload: JSON.stringify({
				action: "request-join-room",
				hostId,
				user: requestFrom.user,
			}),
		});
		return { statusCode: 200 };
	} catch (error) {
		grafana.recordException(error);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Internal Server Error" }),
		};
	}
};

export const handler = wrap_ws(main);
