import arc from '@architect/functions';
import { getAnswers } from 'shared/webrtc';

export const handler = arc.http(async req => {
  if (typeof req.params.id !== 'string') {
    return {
      status: 400,
    cors: true,
      json: { error: 'Invalid username' }
    };
  }
  const username = req.params.id;

  try {
    const data = await getAnswers(username);
    return {
      status: 200,
    cors: true,
      json: data
    };
  }

  catch (error) {
    console.error('Error fetching answer:', username, error);
    return {
      status: 404,
    cors: true,
      json: { error: 'No answer found' }
    };
  }
})
