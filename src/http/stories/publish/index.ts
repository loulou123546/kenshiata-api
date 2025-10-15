import arc from "@architect/functions";
import { type Story, StoryId } from "@shared/types/Story";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { compileStory, getStory } from "shared/game-stories";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			const story_ids = StoryId.safeParse(req.body);
			if (!story_ids.success) {
				return {
					status: 400,
					cors: true,
					json: { data: {}, error: "Invalid story id" },
				};
			}
			const story = await getStory(story_ids.data.id, true);

			// Should validate user is allowed to publish story
			// req.user.id === story.authorId && public == true

			const errors = await compileStory(story);

			grafana.log(
				`Story ${story.name} compiled with ${errors.length} errors`,
				...errors,
			);

			return {
				status: errors.length >= 1 ? 500 : 200,
				cors: true,
				json: {
					errors,
				},
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: { data: {}, error: "Failed to update story" },
			};
		}
	}),
);
