import arc from "@architect/functions";
import { CharacterId } from "@shared/types/Character";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { deleteCharacter } from "shared/characters";
import grafana from "shared/grafana";
import { wrap_http } from "shared/wrap";

export const handler = wrap_http(
	arc.http(authRequired(), async (req: AuthHttpRequest) => {
		try {
			const user = req.user.id;
			const character = CharacterId.safeParse(req.body);
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
			grafana.log(`Character ${character.data.id} deleted`).meta({
				character: character.data,
			});
			await deleteCharacter(character.data);

			return {
				status: 204,
				cors: true,
			};
		} catch (error) {
			grafana.recordException(error);
			return {
				status: 500,
				cors: true,
				json: { data: {}, error: "Failed to delete character" },
			};
		}
	}),
);
