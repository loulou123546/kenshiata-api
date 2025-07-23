import { Context, APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import arc from '@architect/functions';
import { z } from 'zod';
import { type GameSession, getGameSession, updateGameSession } from 'shared/game-sessions';

const PlayerReadySchema = z.object({
  sessionId: z.string(),
  character: z.object({
    userId: z.string(),
	id: z.string().uuid(),
	name: z.string().min(1, "Character name is required"),
	avatar: z.string(),
  }),
  role: z.object({
    tag: z.string()
  })
})

// function verifyAgreeOnVote (session: GameSession): string | false {
//   if (session.players.length < 1) return false;
//   const firstVote = session.players[0].data?.storyVote;
//   if (!firstVote || typeof firstVote !== "string") return false;

//   for (const player of session.players) {
//     if (player.data?.storyVote !== firstVote) return false;
//   }
//   return firstVote;
// }

export const handler = async (event: APIGatewayProxyWebsocketEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
  const connectionId = event.requestContext.connectionId;
  const {sessionId, character, role} = PlayerReadySchema.parse(JSON.parse(event.body));
  
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
  session.players[playerIndex].data.avatar = character.avatar;
  session.players[playerIndex].data.character_name = character.name;

//   const agreement = verifyAgreeOnVote(session);
//   if (agreement) {
//     if (!session?.data) session.data = {};
//     session.data.story = await getStory(agreement);
//     for (const player of session.players) {
//       delete player.data.storyVote;
//     }

//     await updateGameSession(session);
//     await Promise.allSettled(session.players.map(p => {
//       return arc.ws.send({
//         id: p.socketId,
//         payload: JSON.stringify({
//           action: "start-story",
//           story: session.data.story
//         })
//       });
//     }));
//   }
//   else {
    await updateGameSession(session);

    await Promise.allSettled(session.players.map(p => {
      return arc.ws.send({
        id: p.socketId,
        payload: JSON.stringify({
          action: "player-ready",
          player: session.players[playerIndex],
          role
        })
      });
    }));
//   }

  return { statusCode: 200 }
}
