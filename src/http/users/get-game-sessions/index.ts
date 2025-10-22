import arc from "@architect/functions";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { getUserGameSessions } from "shared/game-sessions";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			let id = req.params?.id;
			if (id === "me") {
				id = req.user.id;
			} else {
				return {
					status: 403,
					cors: true,
					json: {
						data: [],
						error: "You don't have the permissions to do this",
					},
				};
			}
			const sessions = await getUserGameSessions(id);

			return {
				status: 200,
				cors: true,
				json: {
					data: sessions,
				},
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: {
					data: [],
					error: "No player or sessions found",
				},
			};
		}
	}),
);
