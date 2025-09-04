import arc from "@architect/functions";
import type { UserIdentity } from "@shared/types/User";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { getGameRoomById } from "shared/game-rooms";
import grafana from "shared/grafana";
import { getIdentityByUserId } from "shared/sockets";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			const user = req.user;
			const gameRoomId = req.params?.id;
			const room = await getGameRoomById(gameRoomId);

			if (
				!room ||
				(!room.public &&
					!room.players.includes(user.id) &&
					!room.invites.includes(user.id))
			) {
				return {
					status: 403,
					cors: true,
					json: { data: {}, error: "Access denied to this game room" },
				};
			}

			const identities: Record<string, UserIdentity> = {};
			const ids = new Set<string>([
				room.hostId,
				...room.players,
				...room.invites,
			]);

			await Promise.allSettled(
				[...ids].map((id) =>
					getIdentityByUserId(id).then((identity) => {
						if (identity?.user) {
							identities[id] = identity.user;
						}
					}),
				),
			);

			return {
				status: 200,
				cors: true,
				json: {
					data: identities,
				},
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: { data: {}, error: "Failed to create socket authentification" },
			};
		}
	}),
);
