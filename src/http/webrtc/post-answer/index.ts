import arc from '@architect/functions';
import { registerAnswer, Answer } from 'shared/webrtc';

export const handler = arc.http(async req => {
  try {
    const data = Answer.parse(req.body);

    await registerAnswer(data.username, data.data);
    return {
      status: 200,
    cors: true,
      json: { message: 'Answer registered successfully' }
    };
  }
  catch (error) {
    console.error('Error processing answer:', error);
    return {
      status: 400,
    cors: true,
      json: { error: 'Invalid request data' }
    };
  }
})
