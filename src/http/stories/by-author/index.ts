import arc from "@architect/functions";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { listStories } from "shared/game-stories";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			let author = req.params?.author;
			if (author === "me") author = req.user.id;
			const stories = await listStories();

			return {
				status: 200,
				cors: true,
				json: {
					data: stories.filter(
						(el) => el.author === author || el.authorId === author,
					),
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
