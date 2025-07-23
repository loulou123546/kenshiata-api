import { z } from 'zod';

export const GameStory = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(256),
});
export type GameStory = z.infer<typeof GameStory>;

export async function listStories (): Promise<GameStory[]> {
    return [
        {
            id: '739cdd12-09c8-4279-9552-e719edd40e83',
            name: 'The beginning',
        },
        {
            id: '02ad2aae-6b6f-4595-b951-7eba437b6938',
            name: 'Power of the ring',
        },
        {
            id: 'ab2e4940-92ca-4ac1-b1ed-2c0a73eb9c75',
            name: 'Bad ending?',
        },
    ]
}

export async function getStory(id: string): Promise<GameStory> {
    const stories = await listStories();
    const story = stories.find((s) => s.id === id);
    if (!story) {
        throw new Error(`Story with ID ${id} not found`);
    }
    return story;
}
