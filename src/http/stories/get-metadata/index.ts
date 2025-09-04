import arc from "@architect/functions";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import grafana from "shared/grafana";
import { getTestStory } from "shared/ink-run";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
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
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: { data: [], error: "No story found" },
			};
		}
	}),
);
