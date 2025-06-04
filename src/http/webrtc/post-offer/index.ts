import arc from '@architect/functions';
import { registerOffer, Offer } from 'shared/webrtc';

export const handler = arc.http(async req => {
  try {
    const data = Offer.parse(req.body);

    await registerOffer(data.username, data.data);
    return {
      status: 200,
    cors: true,
      json: { message: 'Offer registered successfully' }
    };
  }
  catch (error) {
    console.error('Error processing offer:', error);
    return {
      status: 400,
    cors: true,
      json: { error: 'Invalid request data' }
    };
  }
})
