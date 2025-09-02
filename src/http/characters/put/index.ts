import arc from "@architect/functions";
import { Character } from "@shared/types/Character";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { updateCharacter } from "shared/characters";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			const user = req.user.id;
			const character = Character.safeParse(req.body);
			if (!character.success) {
				return {
					status: 400,
					cors: true,
					json: { data: {}, error: "Invalid character" },
				};
			}
			if (character.data.userId !== user) {
				return {
					status: 403,
					cors: true,
					json: { data: {}, error: "Forbidden" },
				};
			}
			const updatedCharacter = await updateCharacter(character.data);
			grafana.log(`Character ${updatedCharacter.id} updated`).meta({
				character: updatedCharacter,
			});

			return {
				status: 200,
				cors: true,
				json: {
					data: updatedCharacter,
				},
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: { data: {}, error: "Failed to update character" },
			};
		}
	}),
);
