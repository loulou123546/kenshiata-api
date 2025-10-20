import arc from "@architect/functions";
import { Achievement, PlayerAchievement } from "@shared/types/Achievement";

export async function getAchievement(
	storyId: string,
	id: string,
): Promise<Achievement> {
	const client = (await arc.tables()).storiesAchievements;
	const achievement = await client.get({ storyId, id });
	return Achievement.parse(achievement);
}
