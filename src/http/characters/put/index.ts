import arc from '@architect/functions';
import { type AuthHttpRequest, authRequired } from 'shared/auth';
import { updateCharacter, Character } from 'shared/characters';

export const handler = arc.http(authRequired(), async (req: AuthHttpRequest) => {
  try {
    const user = req.user.id
    const character = Character.safeParse(req.body);
    if (!character.success) {
      return {
        status: 400,
        cors: true,
        json: { data: {}, error: 'Invalid character' }
      };
    }
    if (character.data.userId !== user) {
      return {
        status: 403,
        cors: true,
        json: { data: {}, error: 'Forbidden' }
      };
    }
    const updatedCharacter = await updateCharacter(character.data);

    return {
      status: 200,
      cors: true,
      json: {
        data: updatedCharacter
      }
    }
  }
  catch (error) {
    console.error('Error updating character:', error);
    return {
      status: 500,
      cors: true,
      json: { data: {}, error: 'Failed to update character' }
    };
  }
})
