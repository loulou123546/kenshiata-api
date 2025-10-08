import arc from "@architect/functions";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { listStories } from "shared/game-stories";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			//const user = req.user.id
			const stories = await listStories();

			return {
				status: 200,
				cors: true,
				json: {
					data: stories.filter((el) => el.public),
				},
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: { data: [], error: "No stories found" },
			};
		}
	}),
);
