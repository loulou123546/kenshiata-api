import arc from "@architect/functions";
import { EditStory, type Story } from "@shared/types/Story";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { editStory } from "shared/game-stories";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			// Should be used to validate user is allowed to edit story
			//const authorId = req.user.id;
			//const authorName = req.user.username;
			const story_base = EditStory.safeParse(req.body);
			if (!story_base.success) {
				return {
					status: 400,
					cors: true,
					json: { data: {}, error: "Invalid story data" },
				};
			}
			const newStory = await editStory(story_base.data);
			grafana.log(`Story ${newStory.name} updated`).meta({
				story: { ...newStory, ink: undefined },
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
				json: { data: {}, error: "Failed to update story" },
			};
		}
	}),
);
