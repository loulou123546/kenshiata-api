import { Context, APIGatewayProxyResultV2, APIGatewayProxyWebsocketEventV2 } from 'aws-lambda';
import arc from '@architect/functions';
import { z } from 'zod';
import { getGameSession } from 'shared/game-sessions';

const BroadcastSchema = z.object({
  sessionId: z.string(),
  internal_action: z.string(),
  internal_payload: z.any(),
})

export const handler = async (event: APIGatewayProxyWebsocketEventV2, context: Context): Promise<APIGatewayProxyResultV2> => {
  const connectionId = event.requestContext.connectionId;
  const {sessionId, internal_action, internal_payload} = BroadcastSchema.parse(JSON.parse(event.body));
  
  const session = await getGameSession(sessionId);
  if (!session.players.some((p) => p.socketId === connectionId)) {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  await Promise.allSettled(session.players.map(p => {
    if (p.socketId === connectionId) return Promise.resolve();
    return arc.ws.send({
      id: p.socketId,
      payload: JSON.stringify({
        action: internal_action,
        ...internal_payload
      })
    });
  }));
  return { statusCode: 200 }
}
