import { Context, APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import arc from '@architect/functions';
import { z } from 'zod';
import { type GameSession, getGameSession, updateGameSession } from 'shared/game-sessions';
import { getStory } from 'shared/game-stories';

const StoryVoteSchema = z.object({
  sessionId: z.string(),
  storyId: z.string().uuid(),
})

function verifyAgreeOnVote (session: GameSession): string | false {
  if (session.players.length < 1) return false;
  const firstVote = session.players[0].data?.storyVote;
  if (!firstVote || typeof firstVote !== "string") return false;

  for (const player of session.players) {
    if (player.data?.storyVote !== firstVote) return false;
  }
  return firstVote;
}

export const handler = async (event: APIGatewayProxyWebsocketEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
  const connectionId = event.requestContext.connectionId;
  const {sessionId, storyId} = StoryVoteSchema.parse(JSON.parse(event.body));
  
  const session = await getGameSession(sessionId);
  let playerIndex = undefined;
  const player = session.players.find((p, ind) => {
    if (p.socketId === connectionId) {
        playerIndex = ind;
        return true;
      }
      return false;
  })
  if (!player || playerIndex === undefined) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  if (!session.players[playerIndex]?.data) session.players[playerIndex].data = {};
  session.players[playerIndex].data.storyVote = storyId;

  const agreement = verifyAgreeOnVote(session);
  if (agreement) {
    if (!session?.data) session.data = {};
    session.data.story = await getStory(agreement);
    for (const player of session.players) {
      delete player.data.storyVote;
    }

    await updateGameSession(session);
    await Promise.allSettled(session.players.map(p => {
      return arc.ws.send({
        id: p.socketId,
        payload: JSON.stringify({
          action: "start-story",
          story: session.data.story
        })
      });
    }));
  }
  else {
    await updateGameSession(session);

    await Promise.allSettled(session.players.map(p => {
      if (p.socketId === connectionId) return Promise.resolve();
      return arc.ws.send({
        id: p.socketId,
        payload: JSON.stringify({
          action: "vote-story",
          userId: player.userId,
          storyId
        })
      });
    }));
  }

  return { statusCode: 200 }
}
