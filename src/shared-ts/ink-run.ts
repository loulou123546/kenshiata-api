import type { GameStoryMetadata } from "@shared/types/GameStory";
import type { StoryLine, Storychoice } from "@shared/types/InkStory";
import { Compiler, Story } from "inkjs/full";
import { getStory } from "./game-stories";
// https://github.com/inkle/ink/blob/master/Documentation/RunningYourInk.md#getting-started-with-the-runtime-api

export class InkPlay {
	story: Story;
	id: string;

	constructor(
		id: string,
		storyFile: string | Story,
		status: string | undefined = undefined,
	) {
		this.id = id;
		this.story =
			typeof storyFile === "string" ? new Story(storyFile) : storyFile;
		if (status !== undefined) {
			this.story.state.LoadJson(status);
		}
	}

	get global(): Record<string, string> {
		const tags = {};
		for (const text of this.story.globalTags) {
			const parts = text.trim().split(":");
			const head = parts.shift().trim();
			tags[head] = parts.join(":").trim();
		}
		return tags;
	}

	get metadata(): GameStoryMetadata {
		const roles: { tag: string; name: string }[] = [];
		if (this.global?.roles?.split(",")) {
			for (const role of this.global.roles.split(",")) {
				const parts = role.split("=").map((p) => p.trim());
				if (parts.length < 2 || parts[0] === "" || parts[1] === "") continue;
				roles.push({ tag: parts[0], name: parts[1] });
			}
		}
		return {
			id: this.id,
			title: this.global?.title,
			roles,
			gamemode: this.global?.gamemode,
		};
	}

	chooseChoice(index: number) {
		while (this.story.currentChoices?.length < 1 && this.story.canContinue) {
			this.story.Continue();
		}
		this.story.ChooseChoiceIndex(index);
	}

	get status(): string {
		return this.story.state.ToJson();
	}

	set status(state: string) {
		this.story.state.LoadJson(state);
	}

	runLines(): { lines: StoryLine[]; choices: Storychoice[] } {
		const lines = [];
		while (this.story.canContinue) {
			const text = this.story.Continue();
			lines.push({ text, tags: this.story.currentTags });
		}
		return {
			lines,
			choices: this.story.currentChoices.map(
				(c: { text: string; tags: string[] }, i: number) => ({
					text: c.text,
					tags: c.tags,
					index: i,
				}),
			),
		};
	}
}

export async function getTestStory(id: string): Promise<InkPlay> {
	const raw_story = await getStory(id);
	const build = new Compiler(raw_story.ink);
	const story = build.Compile();
	return new InkPlay(id, story);
}
