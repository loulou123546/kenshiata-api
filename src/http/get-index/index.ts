import arc from '@architect/functions';

export const handler = arc.http(async req => {
  console.log('Request:', req);
  return {
    json: { message: 'Hello world!' },
  }
})
