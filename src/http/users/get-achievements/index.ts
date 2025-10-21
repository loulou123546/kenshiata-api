import arc from "@architect/functions";
import { getStoryAchievements, getUserAchievements } from "shared/achievements";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			let id = req.params?.id;
			let only_public = true;
			if (id === "me") {
				id = req.user.id;
				only_public = false;
			}
			const achievements = await getUserAchievements(id);

			return {
				status: 200,
				cors: true,
				json: {
					data: only_public
						? achievements.filter((el) => el.public)
						: achievements,
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
