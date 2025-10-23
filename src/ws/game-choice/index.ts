import arc from "@architect/functions";
import type { GameSession } from "@shared/types/GameSession";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import { getAchievement, giveAchievementToUser } from "shared/achievements";
import { getGameSession, updateGameSession } from "shared/game-sessions";
import grafana from "shared/grafana";
import { getPlayableStory } from "shared/ink-run";
import { wrap_ws } from "shared/wrap";
import { z } from "zod";

const StoryVoteSchema = z.object({
	sessionId: z.string(),
	choiceIndex: z.number(),
});

function verifyAgreeOnVote(session: GameSession): number {
	if (session.players.length < 1) return -1;
	const firstVote = session.players[0].data?.choiceVote;
	if (firstVote === undefined || firstVote < 0) return -1;

	for (const player of session.players) {
		if (player.data?.choiceVote !== firstVote) return -1;
	}
	return firstVote;
}

export const main = async (
	event: APIGatewayProxyWebsocketEventV2,
	context: Context,
): Promise<APIGatewayProxyResultV2> => {
	const connectionId = event.requestContext.connectionId;
	const { sessionId, choiceIndex } = StoryVoteSchema.parse(
		JSON.parse(event.body),
	);

	const session = await getGameSession(sessionId);
	let playerIndex = undefined;
	const player = session.players.find((p, ind) => {
		if (p.socketId === connectionId) {
			playerIndex = ind;
			return true;
		}
		return false;
	});
	if (!player || playerIndex === undefined) {
		return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
	}
	session.players[playerIndex].data.choiceVote = choiceIndex;

	//solo mode : const agreement = choiceIndex;
	const agreement = verifyAgreeOnVote(session);
	if (agreement >= 0) {
		// Vote finished

		const ink = await getPlayableStory(session.data.ink.id);
		if (session.data.ink?.state) ink.status = session.data.ink.state;

		ink.chooseChoice(agreement);
		const ink_data = ink.runLines();
		session.data.ink.last_texts = [
			...(session.data.ink.last_texts ?? []),
			...ink_data.lines,
		];
		while (session.data.ink.last_texts.length > 15) {
			session.data.ink.last_texts.shift();
		}

		session.data.ink.state = ink.status;

		for (let i = 0; i < session.players.length; i++) {
			session.players[i].data.choiceVote = -1;
		}
		await updateGameSession(session);

		await Promise.allSettled(
			session.players.map((p) => {
				return arc.ws.send({
					id: p.socketId,
					payload: JSON.stringify({
						action: "game-continue",
						ink_data,
					}),
				});
			}),
		);

		const tags = ink_data.lines.flatMap((line) =>
			line.tags.filter((tag) => tag.startsWith("achievement:")),
		);
		if (tags.length >= 1) {
			const achievements = await Promise.all(
				tags.map((tag) => {
					return getAchievement(session.data.ink.id, tag.split(":").pop());
				}),
			);
			await Promise.allSettled(
				session.players.flatMap((p) => {
					return [
						...achievements.map((achievement) => {
							return giveAchievementToUser(achievement, p.userId).catch(
								(err) => {
									grafana.error(
										`Failed to give achievement ${achievement.id} to user ${p.userId}`,
									);
									grafana.recordException(err);
								},
							);
						}),
						arc.ws.send({
							id: p.socketId,
							payload: JSON.stringify({
								action: "earn-achievements",
								achievements,
							}),
						}),
					];
				}),
			);
		}
	} else {
		// Vote continue
		await updateGameSession(session);

		await Promise.allSettled(
			session.players.map((p) => {
				if (p.socketId === connectionId) return Promise.resolve();
				return arc.ws.send({
					id: p.socketId,
					payload: JSON.stringify({
						action: "game-choice",
						userId: player.userId,
						choiceIndex,
					}),
				});
			}),
		);
	}

	return { statusCode: 200 };
};

export const handler = wrap_ws(main);
