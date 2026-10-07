import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { getApp, API } from './helpers/app.js';
import { makeUser, PASSWORD } from './helpers/factories.js';

// This file runs WITHOUT the whitelist so the real limiter applies
beforeAll(() =>
{
    delete process.env.WHITELISTED_IPS;
});

describe('rate limiting', () =>
{
    it('the 11th login attempt from one IP within the window gets 429 with CORS headers', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        const ip = '203.0.113.7';
        const login = () => request(app).post(`${API}/auth/login`)
            .set('X-Forwarded-For', ip).set('Origin', 'http://localhost:3000')
            .send({ email: user.email, password: PASSWORD });

        for (let i = 0; i < 10; i++)
        {
            expect((await login()).status).toBe(200);
        }
        const blocked = await login();
        expect(blocked.status).toBe(429);
        expect(blocked.body.limitType).toBe('auth');
        expect(blocked.headers['access-control-allow-origin']).toBe('http://localhost:3000');

        // A different IP is unaffected
        const other = await request(app).post(`${API}/auth/login`).set('X-Forwarded-For', '203.0.113.8')
            .send({ email: user.email, password: PASSWORD });
        expect(other.status).toBe(200);
    });
});
