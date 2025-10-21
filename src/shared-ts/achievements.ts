import arc from "@architect/functions";
import { Achievement, PlayerAchievement } from "@shared/types/Achievement";
import grafana from "./grafana";

export async function getAchievement(
	storyId: string,
	id: string,
): Promise<Achievement> {
	const client = (await arc.tables()).storiesAchievements;
	const achievement = await client.get({ storyId, id });
	return Achievement.parse(achievement);
}

export async function userHaveAchievement(
	achievementId: string,
	userId: string,
): Promise<boolean> {
	let already_have = false;
	try {
		const client = await arc.tables();
		if (await client.playersAchievements.get({ userId, achievementId })) {
			already_have = true;
		}
	} catch {}
	return already_have;
}

export async function giveAchievementToUser(
	achievement: Achievement,
	userId: string,
) {
	if (await userHaveAchievement(achievement.id, userId)) {
		grafana.log(
			`User ${userId} got achievement that he already had ${achievement.id}`,
		);
		return;
	}

	const client = await arc.tables();
	const data: PlayerAchievement = {
		userId,
		storyId: achievement.storyId,
		achievementId: achievement.id,
		title: achievement.title,
		description: achievement.description,
		public: achievement.public,
		firstEarned: new Date().toISOString(),
	};

	grafana.log(`User ${userId} got new achievement ${achievement.id}`);
	await client.playersAchievements.put(data);
}

export async function giveAchievementToUserById(
	achievementId: string,
	storyId: string,
	userId: string,
) {
	const achievement = await getAchievement(storyId, achievementId);
	if (!achievement)
		throw new Error(
			`Unable to find achievement ${achievementId} in story ${storyId}`,
		);
	await await giveAchievementToUser(achievement, userId);
}

export async function getUserAchievements(
	userId: string,
): Promise<PlayerAchievement[]> {
	const achievements = [];

	try {
		const client = await arc.tables();
		const res = await client.playersAchievements.query({
			KeyConditionExpression: "userId = :userId",
			ExpressionAttributeValues: { ":userId": userId },
		});
		for (const achievement of res.Items) {
			const parsed = PlayerAchievement.safeParse(achievement);
			if (parsed.success) achievements.push(parsed.data);
		}
	} catch {}

	return achievements;
}

export async function getStoryAchievements(
	storyId: string,
): Promise<Achievement[]> {
	const achievements = [];

	try {
		const client = await arc.tables();
		const res = await client.storiesAchievements.query({
			KeyConditionExpression: "storyId = :storyId",
			ExpressionAttributeValues: { ":storyId": storyId },
		});
		for (const achievement of res.Items) {
			const parsed = Achievement.safeParse(achievement);
			if (parsed.success) achievements.push(parsed.data);
		}
	} catch {}

	return achievements;
}
