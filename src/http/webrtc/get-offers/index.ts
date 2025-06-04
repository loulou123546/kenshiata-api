import arc from '@architect/functions';
import { getOffers } from 'shared/webrtc';

export const handler = arc.http(async req => {
  try {
    const list = await getOffers();
    return {
      status: 200,
    cors: true,
      json: list
    };
  }
  catch (error) {
    console.error('Error listing offers:', error);
    return {
      status: 404,
    cors: true,
      json: { error: 'No offers found' }
    };
  }
})
