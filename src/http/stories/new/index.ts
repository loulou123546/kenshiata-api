import arc from "@architect/functions";
import { CreateStory } from "@shared/types/Story";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { createStory } from "shared/game-stories";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			const authorId = req.user.id;
			const authorName = req.user.username;
			const story_base = CreateStory.pick({ name: true }).safeParse(req.body);
			if (!story_base.success) {
				return {
					status: 400,
					cors: true,
					json: { data: {}, error: "Invalid name" },
				};
			}
			const newStory = await createStory({
				name: story_base.data.name,
				authorId,
				author: authorName,
			});
			grafana.log(`Story ${newStory.name} created`).meta({
				story: newStory,
			});

			return {
				status: 200,
				cors: true,
				json: {
					data: newStory,
				},
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: { data: {}, error: "Failed to create story" },
			};
		}
	}),
);
