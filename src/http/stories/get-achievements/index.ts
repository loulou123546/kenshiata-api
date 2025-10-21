import arc from "@architect/functions";
import { getStoryAchievements } from "shared/achievements";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			const id = req.params?.id;
			const achievements = await getStoryAchievements(id);

			return {
				status: 200,
				cors: true,
				json: {
					data: achievements.filter((el) => el.public),
				},
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: {
					data: [],
					error:
						"No story found or no achievements are available for this story",
				},
			};
		}
	}),
);
