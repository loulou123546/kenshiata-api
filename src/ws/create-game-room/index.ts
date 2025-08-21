import arc from "@architect/functions";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import { createGameRoom } from "shared/game-rooms";
import { broadcastAllSockets, getIdentityBySocketId } from "shared/sockets";
import { z } from "zod";

const CreateGameRoomSchema = z.object({
	is_public: z.boolean(),
	name: z.string().min(1).max(256),
});

export const handler = async (
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
		console.error("Error processing request:", error);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Internal Server Error" }),
		};
	}
};
