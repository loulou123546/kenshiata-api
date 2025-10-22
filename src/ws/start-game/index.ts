import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import { deleteGameRoom, getGameRoomById } from "shared/game-rooms";
import {
	broadcastToGameSession,
	convertGameRoomToSession,
} from "shared/game-sessions";
import grafana from "shared/grafana";
import { getIdentityBySocketId } from "shared/sockets";
import { wrap_ws } from "shared/wrap";
import { z } from "zod";

const StartGameSchema = z.object({
	hostId: z.string().uuid(),
});

function delay(ms: number) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export const main = async (
	event: APIGatewayProxyWebsocketEventV2,
	context: Context,
): Promise<APIGatewayProxyResultV2> => {
	const connectionId = event.requestContext.connectionId;
	try {
		const { hostId } = StartGameSchema.parse(JSON.parse(event.body));

		const requestFrom = await getIdentityBySocketId(connectionId);
		if (
			requestFrom.socketId !== connectionId ||
			hostId !== requestFrom.user.id
		) {
			return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
		}
		const room = await getGameRoomById(hostId);
		if (
			!room.players.includes(requestFrom.user.id) ||
			room.hostId !== requestFrom.user.id
		) {
			return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
		}

		const session = await convertGameRoomToSession(room);
		await broadcastToGameSession(session, "start-game", {
			hostId,
			...session,
		});

		await delay(1000); // Give a second for client game to process start-game before deleting the room
		await deleteGameRoom(room.hostId, true);

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
