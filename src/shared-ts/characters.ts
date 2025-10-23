import arc from "@architect/functions";
import {
	Character,
	type CharacterId,
	type NewCharacter,
} from "@shared/types/Character";
import s3client from "shared/s3";
import { uuidv7 } from "uuidv7";

const s3 = s3client("kenshiata-data-prod");

const base64_parsing = /^data:([a-z0-9\/]*);base64,(.*)$/is;

export async function listCharacters(userId: string): Promise<Character[]> {
	const client = (await arc.tables()).characters;
	const characters = await client.query({
		KeyConditionExpression: "userId = :userId",
		ExpressionAttributeValues: {
			":userId": userId,
		},
	});
	return characters.Items.map((el) => {
		try {
			return Character.parse(el);
		} catch {
			return undefined;
		}
	}).filter((el) => el !== undefined) as Character[];
}

export async function newCharacter(
	userId: string,
	newCharacter: NewCharacter,
): Promise<Character> {
	const client = (await arc.tables()).characters;
	const character = {
		...newCharacter,
		userId,
		id: uuidv7(),
	};
	if (character.avatar === "custom" && character.avatar_base64) {
		const parsed = base64_parsing.exec(character.avatar_base64);
		if (parsed.length < 3) throw new Error("Invalid base64 data");
		if (!parsed[1].startsWith("image/"))
			throw new Error("Uploaded something else than image");
		const ts = Date.now();
		await s3.put(
			`public/avatars/${userId}:${character.id}:${ts}`,
			Buffer.from(parsed[2] as string, "base64"),
			{
				ContentType: parsed[1],
			},
		);
		character.avatar = `custom:${ts}`;
	}
	delete character.avatar_base64;
	await client.put(character);
	return character;
}

export async function updateCharacter(
	character: Character,
): Promise<Character> {
	const client = (await arc.tables()).characters;
	const oldCharacter = await client.get({
		userId: character.userId,
		id: character.id,
	});
	if (!oldCharacter) {
		throw new Error("Character not found");
	}
	if (character.avatar === "custom" && character.avatar_base64) {
		const parsed = base64_parsing.exec(character.avatar_base64);
		if (parsed.length < 3) throw new Error("Invalid base64 data");
		if (!parsed[1].startsWith("image/"))
			throw new Error("Uploaded something else than image");
		const ts = Date.now();
		await s3.put(
			`public/avatars/${character.userId}:${character.id}:${ts}`,
			Buffer.from(parsed[2] as string, "base64"),
			{
				ContentType: parsed[1],
			},
		);
		character.avatar = `custom:${ts}`;
	}
	if (oldCharacter.avatar.startsWith("custom:")) {
		try {
			await s3.delete(
				`public/avatars/${character.userId}:${character.id}:${oldCharacter.avatar.split(":")[1]}`,
			);
		} catch {
			// ignore
		}
	}
	delete character.avatar_base64;
	await client.put(character);
	return character;
}

export async function deleteCharacter(character: CharacterId): Promise<void> {
	const client = (await arc.tables()).characters;

	try {
		const oldCharacter = await client.get({
			userId: character.userId,
			id: character.id,
		});
		if (oldCharacter.avatar.startsWith("custom:")) {
			await s3.delete(
				`public/avatars/${character.userId}:${character.id}:${oldCharacter.avatar.split(":")[1]}`,
			);
		}
	} catch {
		// ignore
	}

	await client.delete({ userId: character.userId, id: character.id });
}
