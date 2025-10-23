import arc from "@architect/functions";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { deleteUserGameSession } from "shared/game-sessions";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			let userId = req.params?.userId;
			const sessionId = req.params?.sessionId;
			if (userId === "me") {
				userId = req.user.id;
			} else {
				return {
					status: 403,
					cors: true,
					json: {
						error: "You don't have the permissions to do this",
					},
				};
			}
			await deleteUserGameSession(userId, sessionId);

			return {
				status: 200,
				cors: true,
				json: { ok: true },
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: {
					error: "No player or session found",
				},
			};
		}
	}),
);
