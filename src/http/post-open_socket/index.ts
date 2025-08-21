import arc from "@architect/functions";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { initNewSocketAuth } from "shared/sockets";

export const handler = arc.http(
	authRequired(),
	async (req: AuthHttpRequest) => {
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
			console.error("Error creating socket authentification:", error);
			return {
				status: 500,
				cors: true,
				json: { data: {}, error: "Failed to create socket authentification" },
			};
		}
	},
);
