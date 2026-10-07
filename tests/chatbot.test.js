import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { __generateContent as generateContent } from '../modules/chatBot/geminiClient.js';
import { smartAskWithRAG } from '../modules/chatBot/rag.service.js';
import { getApp, API } from './helpers/app.js';

const GREETING_MARKER = 'أنا سكّنلي بوت';
const reply = (text) => ({ response: { text: async () => text } });

describe('chatbot greeting detection (L11)', () =>
{
    it.each(['hi', 'Hello there', 'who are you?', 'أهلاً', 'ازيك'])('"%s" gets the greeting without calling the model', async (q) =>
    {
        const answer = await smartAskWithRAG(q);
        expect(answer).toContain(GREETING_MARKER);
        expect(generateContent).not.toHaveBeenCalled();
    });

    it.each(['which property is cheapest', 'is this flat near the station', 'within budget please', 'show me something'])(
        '"%s" contains "hi" inside a word and reaches the model', async (q) =>
        {
            generateContent.mockResolvedValueOnce(reply('submit'));
            const answer = await smartAskWithRAG(q);
            expect(answer).not.toContain(GREETING_MARKER);
            expect(generateContent).toHaveBeenCalledTimes(1);
        });
});

describe('POST /chat', () =>
{
    it('validates the question and maps model failures to 503', async () =>
    {
        const app = await getApp();
        expect((await request(app).post(`${API}/chat`).send({ question: '' })).status).toBe(400);
        expect((await request(app).post(`${API}/chat`).send({ question: 'x'.repeat(501) })).status).toBe(400);

        generateContent.mockRejectedValueOnce(new Error('quota'));
        expect((await request(app).post(`${API}/chat`).send({ question: 'which apartments are cheap' })).status).toBe(503);

        generateContent.mockResolvedValueOnce(reply('submit'));
        const ok = await request(app).post(`${API}/chat`).send({ question: 'which apartments are cheap' });
        expect(ok.status).toBe(200);
        expect(ok.body.answer).not.toContain(GREETING_MARKER);
    });
});
