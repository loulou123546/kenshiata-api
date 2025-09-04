import arc from "@architect/functions";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { getStory } from "shared/game-stories";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			const id = req.params?.id;
			const story = await getStory(id);

			return {
				status: 200,
				cors: true,
				json: {
					data: story,
				},
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: { data: [], error: "No story with this id found" },
			};
		}
	}),
);
