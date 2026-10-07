import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { getApp, API } from './helpers/app.js';

describe('app boot', () =>
{
    it('reports health and serves DB-backed routes from the in-memory database', async () =>
    {
        const app = await getApp();

        const health = await request(app).get(`${API}/health`);
        expect(health.status).toBe(200);
        expect(health.body.success).toBe(true);

        const list = await request(app).get(`${API}/properties/allProperties`);
        expect(list.status).toBe(200);
        expect(list.body.data).toEqual([]);
    });
});
