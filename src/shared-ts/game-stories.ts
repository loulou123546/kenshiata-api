import arc from "@architect/functions";
import {
	type CreateStory,
	type EditStory,
	Stories,
	type Story,
	type StoryWithoutInk,
} from "@shared/types/Story";
import s3client from "shared/s3";
import { uuidv7 } from "uuidv7";

const s3 = s3client("kenshiata-data-prod");

export async function listStories(): Promise<Stories> {
	const client = (await arc.tables()).stories;
	const list = await client.scanAll();
	return Stories.parse(list);
}

export async function getStory(id: string): Promise<Story> {
	const client = (await arc.tables()).stories;
	const story: Story = await client.get({ id });
	if (!story) {
		throw new Error(`Story with ID ${id} not found`);
	}
	const file = await s3.get(`stories/${id}.json`);
	story.ink = await file.text();
	return story;
}

export async function createStory(story: CreateStory): Promise<Story> {
	const full_story: StoryWithoutInk = {
		...story,
		id: uuidv7(),
		lastUpdated: new Date().toISOString(),
		public: false,
	};
	const ink =
		"Welcome to the editor\n\n * Start writing\n * Play the game\n\n- Few hours later...\n->END\n";
	const client = (await arc.tables()).stories;
	await client.put(full_story);
	await s3.put(`stories/${full_story.id}.json`, ink);
	return { ...full_story, ink };
}

export async function editStory(story: EditStory): Promise<Story> {
	const client = (await arc.tables()).stories;
	const previous: Story = await client.get({ id: story.id });
	if (!previous) {
		throw new Error(`Story with ID ${story.id} not found`);
	}

	const full_story: Story = {
		...previous,
		lastUpdated: new Date().toISOString(),
		name: story.name,
		public: story.public,
	};
	await client.put(full_story);
	await s3.put(`stories/${full_story.id}.json`, story.ink);
	return { ...full_story, ink: story.ink };
}
