import arc from "@architect/functions";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { listCharacters } from "shared/characters";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			const user = req.user.id;
			const characters = await listCharacters(user);

			return {
				status: 200,
				cors: true,
				json: {
					data: characters,
				},
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: { data: [], error: "No characters found" },
			};
		}
	}),
);
