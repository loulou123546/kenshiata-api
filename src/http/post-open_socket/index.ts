import arc from "@architect/functions";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import grafana from "shared/grafana";
import { initNewSocketAuth } from "shared/sockets";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			const user = req.user;
			const token = await initNewSocketAuth(user);

			return {
				status: 200,
				cors: true,
				json: {
					data: {
						token,
					},
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
