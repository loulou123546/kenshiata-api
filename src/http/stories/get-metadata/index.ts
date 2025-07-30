import arc from '@architect/functions';
import { type AuthHttpRequest, authRequired } from 'shared/auth';
import { getTestStory } from 'shared/ink-run';

export const handler = arc.http(authRequired(), async (req: AuthHttpRequest) => {
  try {
    //const user = req.user.id
    const storyId = req.params?.id;
    const ink = await getTestStory(storyId);

    const roles: {tag: string, name: string}[] = []
    ink.global?.roles?.split(",")?.forEach((el: string) => {
      const parts = el.split("=").map(p => p.trim());
      if (parts.length < 2 || parts[0] === "" || parts[1] === "") return;
      roles.push({tag: parts[0], name: parts[1]});
    })

    return {
      status: 200,
      cors: true,
      json: {
        id: storyId,
        title: ink.global?.title,
        roles
      }
    }
  }
  catch (error) {
    console.error('Error fetching metadata of story:', error);
    return {
      status: 500,
      cors: true,
      json: { data: [], error: 'No story found' }
    };
  }
})
