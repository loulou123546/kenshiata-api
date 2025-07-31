import { Story } from "inkjs";
import { z } from "zod";
// https://github.com/inkle/ink/blob/master/Documentation/RunningYourInk.md#getting-started-with-the-runtime-api

const STORY_TAGS = JSON.stringify({"inkVersion":21,"root":[["#","^title: The test story","/#","#","^roles: dog=Jimy's dog, dad=Jimy's super cool dad","/#","#","^gamemode: each-player-have-role","/#","^Early in the morning, sunday ","#","^narative","/#","\n","^dad: Hey Jimy, how ru ?","\n","^Jimy: Fine and you ?","\n",["ev",{"^->":"0.18.$r1"},{"temp=":"$r"},"str",{"->":".^.s"},[{"#n":"$r1"}],"/str","str","^Great!","/str","/ev",{"*":"0.c-0","flg":22},{"s":["#","^enjoy ","/#",{"->":"$r","var":true},null]}],["ev",{"^->":"0.19.$r1"},{"temp=":"$r"},"str",{"->":".^.s"},[{"#n":"$r1"}],"/str","str","^Amazing!","/str","/ev",{"*":"0.c-1","flg":22},{"s":["#","^enjoy++ ","/#",{"->":"$r","var":true},null]}],{"c-0":["ev",{"^->":"0.c-0.$r2"},"/ev",{"temp=":"$r"},{"->":"0.18.s"},[{"#n":"$r2"}],"^ dad: Great!","\n",{"->":"0.g-0"},{"#f":5}],"c-1":["ev",{"^->":"0.c-1.$r2"},"/ev",{"temp=":"$r"},{"->":"0.19.s"},[{"#n":"$r2"}],"^ dad: Amazingly!","\n",{"->":"0.g-0"},{"#f":5}],"g-0":["^Jimy: Why are you up so early? ","#","^happy","/#","\n","ev","str","^Go to movie theater","/str","/ev",{"*":".^.c-2","flg":20},"ev","str","^Go to amusement park","/str","/ev",{"*":".^.c-3","flg":20},{"c-2":["^ Because today, we are going to see Shark2!","\n",{"->":"0.g-1"},{"#f":5}],"c-3":["^ Because Puy du Fou open at nine!","\n",{"->":"0.g-1"},{"#f":5}],"#f":5}],"g-1":["^Jimy: YEAHHHH","\n","end",["done",{"#f":5,"#n":"g-2"}],{"#f":5}]}],"done",{"#f":1}],"listDefs":{}});

export const StoryLine = z.object({
    text: z.string(),
    tags: z.array(z.string())
});
export type StoryLine = z.infer<typeof StoryLine>;

export const Storychoice = z.object({
    text: z.string(),
    index: z.number(),
    tags: z.array(z.string())
});
export type Storychoice = z.infer<typeof Storychoice>;

export const StoryMetadata = z.object({
    title: z.string().optional(),
	roles: z.array(
		z.object({
			tag: z.string(),
			name: z.string(),
		}),
	),
    gamemode: z.string().optional(),
});
export type StoryMetadata = z.infer<typeof StoryMetadata>;

export class InkPlay {
    story: Story

    constructor(storyFile: string, status: string|undefined = undefined) {
        this.story = new Story(storyFile);
        if (status !== undefined) {
            this.story.state.LoadJson(status);
        }
    }

    get global(): Record<string, string> {
        const tags = {}
        this.story.globalTags.forEach(text => {
            const parts = text.trim().split(':')
            const head = parts.shift().trim()
            tags[head] = parts.join(':').trim()
        });
        return tags;
    }

    get metadata(): StoryMetadata {
        const roles: {tag: string, name: string}[] = [];
        this.global?.roles?.split(",")?.forEach((el: string) => {
            const parts = el.split("=").map(p => p.trim());
            if (parts.length < 2 || parts[0] === "" || parts[1] === "") return;
            roles.push({tag: parts[0], name: parts[1]});
        })

        return {
            title: this.global?.title,
            roles,
            gamemode: this.global?.gamemode
        }
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

    runLines (): {lines: StoryLine[]; choices: Storychoice[]} {
        const lines = []
        while (this.story.canContinue) {
            const text = this.story.Continue();
            lines.push({text, tags: this.story.currentTags});
        }
        return {lines, choices: this.story.currentChoices.map((c: any, i: number) => ({text: c.text, tags: c.tags, index: i}))};
    }
}

export function getTestStory (_id: string): InkPlay {
    return new InkPlay(STORY_TAGS)
}
