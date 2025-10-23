import arc from "@architect/functions";
import type { SocketIdentity } from "@shared/types/SocketIdentity";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import { getGameSession } from "shared/game-sessions";
import grafana from "shared/grafana";
import { closeSocketBySocketId, getIdentityBySocketId } from "shared/sockets";
import { wrap_ws } from "shared/wrap";

export const main = async (
	event: APIGatewayProxyWebsocketEventV2,
	context: Context,
): Promise<APIGatewayProxyResultV2> => {
	const connectionId = event.requestContext.connectionId;
	let userData: SocketIdentity;
	try {
		userData = await getIdentityBySocketId(connectionId);
	} catch (e) {
		grafana.warning(
			`Unable to find user related to socket ${connectionId} when disconnected`,
		);
		grafana.recordException(e);
	}
	try {
		await closeSocketBySocketId(connectionId);
	} catch (e) {
		console.warn(e);
	}

	if (userData?.gameSession) {
		try {
			const session = await getGameSession(userData.gameSession);
			const disconnectedPlayer = session.players.find(
				(p) => p.socketId === connectionId || p.userId === userData?.user?.id,
			);
			await Promise.allSettled(
				session.players.map((player) => {
					if (player.socketId === connectionId) return Promise.resolve();
					return arc.ws
						.send({
							id: player.socketId,
							payload: JSON.stringify({
								action: "player-join-left",
								join: false,
								name: `${userData.user.username} (${disconnectedPlayer?.data?.character_name ?? "?"})`,
							}),
						})
						.catch((err) => {
							grafana.recordException(err);
						});
				}),
			);
		} catch (e) {
			grafana.warning(
				`Failed to cast left notyf to players when socket ${connectionId} disconnected`,
			);
			grafana.recordException(e);
		}
	}

	return { statusCode: 200 };
};

export const handler = wrap_ws(main);
