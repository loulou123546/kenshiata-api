import arc from "@architect/functions";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import { getGameRoomById, updateGameRoom } from "shared/game-rooms";
import grafana from "shared/grafana";
import {
	broadcastAllSockets,
	getIdentityBySocketId,
	getIdentityByUserId,
} from "shared/sockets";
import { wrap_ws } from "shared/wrap";
import { z } from "zod";

const JoinSchema = z.object({
	hostId: z.string().uuid(),
	userId: z.string().uuid(),
	accept: z.boolean(),
});

export const main = async (
	event: APIGatewayProxyWebsocketEventV2,
	context: Context,
): Promise<APIGatewayProxyResultV2> => {
	const connectionId = event.requestContext.connectionId;
	try {
		const { hostId, userId, accept } = JoinSchema.parse(JSON.parse(event.body));

		const requestFrom = await getIdentityBySocketId(connectionId);
		if (
			requestFrom.user.id !== hostId ||
			requestFrom.socketId !== connectionId
		) {
			return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
		}
		const target = await getIdentityByUserId(userId);
		const room = await getGameRoomById(hostId);

		await arc.ws.send({
			id: target.socketId,
			payload: JSON.stringify({
				action: "respond-join-room",
				hostId,
				accept,
			}),
		});

		if (!accept) {
			return { statusCode: 200 };
		}

		const uptodate_room = await updateGameRoom({
			...room,
			players: [...new Set([...room.players, userId])],
		});
		await broadcastAllSockets({
			action: "update-game-rooms",
			updateRooms: [uptodate_room],
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
