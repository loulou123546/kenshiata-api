import arc from "@architect/functions";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import { createGameRoom } from "shared/game-rooms";
import grafana from "shared/grafana";
import { broadcastAllSockets, getIdentityBySocketId } from "shared/sockets";
import { wrap_ws } from "shared/wrap";
import { z } from "zod";

const CreateGameRoomSchema = z.object({
	is_public: z.boolean(),
	name: z.string().min(1).max(256),
});

export const main = async (
	event: APIGatewayProxyWebsocketEventV2,
	context: Context,
): Promise<APIGatewayProxyResultV2> => {
	const connectionId = event.requestContext.connectionId;
	try {
		const data = JSON.parse(event.body);
		const parsedData = CreateGameRoomSchema.parse(data);

		const identity = await getIdentityBySocketId(connectionId);
		const room = await createGameRoom(
			identity.user.id,
			parsedData.is_public,
			parsedData.name,
		);
		grafana
			.log(
				`Created new game room ${room.name} [${room.public ? "public" : "private"}]`,
			)
			.meta({ room });
		if (parsedData.is_public) {
			await broadcastAllSockets({
				action: "update-game-rooms",
				updateRooms: [room],
			});
		} else {
			await arc.ws.send({
				id: connectionId,
				payload: JSON.stringify({
					action: "update-game-rooms",
					updateRooms: [room],
				}),
			});
		}
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
