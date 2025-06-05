import { z } from 'zod';
import arc from '@architect/functions';

export const HelloInit = z.object({
    username: z.string().min(1, 'Username is required'),
})
export type HelloInit = z.infer<typeof HelloInit>;

export const Offer = z.object({
    username: z.string().min(1, 'Username is required'),
    data: z.string()
})
export type Offer = z.infer<typeof Offer>;

export const Answer = z.object({
    username: z.string().min(1, 'Username is required'),
    target: z.string().min(1, 'Target is required'),
    data: z.string()
})
export type Answer = z.infer<typeof Answer>;

export async function registerOffer(username: string, data: string): Promise<void> {
    const client = (await arc.tables()).webrtc;
    const existing = await client.get({ id: username });
    await client.put({ ...existing, id: username, offer: data, expires: Date.now() + 1000 * 3600 }); // 1 hour expiry
}

export async function registerAnswer(username: string, data: string, target: string): Promise<void> {
    const client = (await arc.tables()).webrtc;
    const existing = await client.get({ id: target });
    await client.put({ ...existing, id: target, answer: data, answer_by: username, expires: Date.now() + 1000 * 3600 }); // 1 hour expiry
}

export async function getOffers(): Promise<Offer[]> {
    const client = (await arc.tables()).webrtc;
    const offers = await client.scan({ limit: 10 });
    return offers.Items.map(el => {
        try {
            return Offer.parse({ username: el.id, data: el.offer });
        } catch {
            return undefined;
        }
    }).filter(el => el !== undefined) as Offer[];
}

export async function getAnswers(username: string): Promise<Answer> {
    const client = (await arc.tables()).webrtc;
    const answer = await client.get({ id: username });
    return Answer.parse({ username: answer.id, data: answer.answer, target: answer.answer_by });
}
