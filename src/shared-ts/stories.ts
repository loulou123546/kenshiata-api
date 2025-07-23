import { z } from 'zod';
import arc from '@architect/functions';
import { uuidv7 } from "uuidv7";

export const StoryPublicData = z.object({
    id: z.string(),
    name: z.string().min(1, 'Character name is required'),
    thumbnail: z.string(),
    next: z.string().optional()
});
export type StoryPublicData = z.infer<typeof StoryPublicData>;

export async function listCharacters(userId: string): Promise<Character[]> {
    const client = (await arc.tables()).characters;
    const characters = await client.query({
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
            ':userId': userId
        }
    })
    return characters.Items.map(el => {
        try {
            return Character.parse(el);
        } catch {
            return undefined;
        }
    }).filter(el => el !== undefined) as Character[];
}

export async function newCharacter(userId: string, newCharacter: NewCharacter): Promise<Character> {
    const client = (await arc.tables()).characters;
    const character = {
        ...newCharacter,
        userId,
        id: uuidv7()
    }
    await client.put(character);
    return character;
}

export async function updateCharacter(character: Character): Promise<Character> {
    const client = (await arc.tables()).characters;
    const oldCharacter = await client.get({ userId: character.userId, id: character.id });
    if (!oldCharacter) {
        throw new Error('Character not found');
    }
    await client.put(character);
    return character;
}

export async function deleteCharacter(character: CharacterId): Promise<void> {
    const client = (await arc.tables()).characters;
    await client.delete({ userId: character.userId, id: character.id });
}
