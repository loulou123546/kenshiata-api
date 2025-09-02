import arc from "@architect/functions";
import { NewCharacter } from "@shared/types/Character";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { newCharacter } from "shared/characters";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			const user = req.user.id;
			const character = NewCharacter.safeParse(req.body);
			if (!character.success) {
				return {
					status: 400,
					cors: true,
					json: { data: {}, error: "Invalid character" },
				};
			}
			const createdCharacter = await newCharacter(user, character.data);
			grafana.log(`Character ${createdCharacter.name} created`).meta({
				character: createdCharacter,
			});

			return {
				status: 200,
				cors: true,
				json: {
					data: createdCharacter,
				},
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: { data: {}, error: "Failed to create character" },
			};
		}
	}),
);
