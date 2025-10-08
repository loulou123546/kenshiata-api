import arc from "@architect/functions";
import type { GameSession } from "@shared/types/GameSession";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import { getGameSession, updateGameSession } from "shared/game-sessions";
import { getStory } from "shared/game-stories";
import { getTestStory } from "shared/ink-run";
import { wrap_ws } from "shared/wrap";
import { z } from "zod";

const StoryVoteSchema = z.object({
	sessionId: z.string(),
	storyId: z.string().uuid(),
});

function verifyAgreeOnVote(session: GameSession): string | false {
	if (session.players.length < 1) return false;
	const firstVote = session.players[0].data?.storyVote;
	if (!firstVote || typeof firstVote !== "string") return false;

	for (const player of session.players) {
		if (player.data?.storyVote !== firstVote) return false;
	}
	return firstVote;
}

export const main = async (
	event: APIGatewayProxyWebsocketEventV2,
	context: Context,
): Promise<APIGatewayProxyResultV2> => {
	const connectionId = event.requestContext.connectionId;
	const { sessionId, storyId } = StoryVoteSchema.parse(JSON.parse(event.body));

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

	if (!session.players[playerIndex]?.data)
		session.players[playerIndex].data = {};
	session.players[playerIndex].data.storyVote = storyId;

	const agreement = verifyAgreeOnVote(session);
	if (agreement) {
		// Vote finished

		if (!session?.data) session.data = {};
		session.data.story = await getStory(agreement);
		const story_ink = await getTestStory(agreement);
		session.data.ink = {
			id: agreement,
			metadata: story_ink.metadata,
		};
		session.data.roles_player = {};
		if (story_ink?.metadata?.roles) {
			for (const role of Object.values(story_ink.metadata.roles)) {
				session.data.roles_player[role.tag] = -1;
			}
		}
		for (const player of session.players) {
			delete player.data.storyVote;
		}

		await updateGameSession(session);
		await Promise.allSettled(
			session.players.map((p) => {
				return arc.ws.send({
					id: p.socketId,
					payload: JSON.stringify({
						action: "start-story",
						session_data: session.data,
					}),
				});
			}),
		);
	} else {
		// Vote continue
		await updateGameSession(session);

		await Promise.allSettled(
			session.players.map((p) => {
				if (p.socketId === connectionId) return Promise.resolve();
				return arc.ws.send({
					id: p.socketId,
					payload: JSON.stringify({
						action: "vote-story",
						userId: player.userId,
						storyId,
					}),
				});
			}),
		);
	}

	return { statusCode: 200 };
};

export const handler = wrap_ws(main);
