import arc from "@architect/functions";
import { NewCharacter } from "@shared/types/Character";
import { type AuthHttpRequest, authRequired } from "shared/auth";
import { newCharacter } from "shared/characters";

export const handler = arc.http(
	authRequired(),
	async (req: AuthHttpRequest) => {
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

			return {
				status: 200,
				cors: true,
				json: {
					data: createdCharacter,
				},
			};
		} catch (error) {
			console.error("Error creating character:", error);
			return {
				status: 500,
				cors: true,
				json: { data: {}, error: "Failed to create character" },
			};
		}
	},
);
