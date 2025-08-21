import arc from "@architect/functions";
import type { GameSession } from "@shared/types/GameSession";
import type {
	APIGatewayProxyResultV2,
	APIGatewayProxyWebsocketEventV2,
	Context,
} from "aws-lambda";
import { getGameSession, updateGameSession } from "shared/game-sessions";
import { getTestStory } from "shared/ink-run";
import { z } from "zod";

const StoryVoteSchema = z.object({
	sessionId: z.string(),
	choiceIndex: z.number(),
});

function verifyAgreeOnVote(session: GameSession): number {
	return -1;
}

export const handler = async (
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

	const agreement = choiceIndex; //verifyAgreeOnVote(session);
	if (agreement >= 0) {
		// Vote finished

		const ink = getTestStory(session.data.ink.id);
		if (session.data.ink?.state) ink.status = session.data.ink.state;

		ink.chooseChoice(agreement);
		const ink_data = ink.runLines();

		session.data.ink.state = ink.status;
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
