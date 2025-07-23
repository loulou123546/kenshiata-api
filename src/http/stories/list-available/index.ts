import arc from '@architect/functions';
import { type AuthHttpRequest, authRequired } from 'shared/auth';
import { listStories } from 'shared/game-stories';

export const handler = arc.http(authRequired(), async (req: AuthHttpRequest) => {
  try {
    //const user = req.user.id
    const stories = await listStories();

    return {
      status: 200,
      cors: true,
      json: {
        data: stories
      }
    }
  }
  catch (error) {
    console.error('Error listing stories:', error);
    return {
      status: 500,
      cors: true,
      json: { data: [], error: 'No stories found' }
    };
  }
})
