import arc from "@architect/functions";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { getTestStory } from "shared/ink-run";

export const handler = arc.http(
	authRequired(),
	async (req: AuthHttpRequest) => {
		try {
			//const user = req.user.id
			const storyId = req.params?.id;
			const ink = await getTestStory(storyId);

			return {
				status: 200,
				cors: true,
				json: {
					...ink.metadata,
					id: storyId,
				},
			};
		} catch (error) {
			console.error("Error fetching metadata of story:", error);
			return {
				status: 500,
				cors: true,
				json: { data: [], error: "No story found" },
			};
		}
	},
);
