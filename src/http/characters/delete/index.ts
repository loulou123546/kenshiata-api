import arc from '@architect/functions';
import { type AuthHttpRequest, authRequired } from 'shared/auth';
import { deleteCharacter, CharacterId } from 'shared/characters';

export const handler = arc.http(authRequired(), async (req: AuthHttpRequest) => {
  try {
    const user = req.user.id
    const character = CharacterId.safeParse(req.body);
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
    await deleteCharacter(character.data);

    return {
      status: 204,
      cors: true,
    }
  }
  catch (error) {
    console.error('Error deleting character:', error);
    return {
      status: 500,
      cors: true,
      json: { data: {}, error: 'Failed to delete character' }
    };
  }
})
