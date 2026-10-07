// Smoke test that needs no database: boots the app the way Vercel does and checks
// that it imports cleanly, reports DB state on /health and degrades to 503 JSON.
//   npm run test:smoke
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.VERCEL = '1';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:1/saknly-smoke'; // nothing listens on port 1
process.env.JWT_SECRET = process.env.JWT_SECRET || 'smoke-test-secret';
process.env.BEARER_KEY = 'Saknly__';
process.env.CLIENT_URL = 'http://localhost:3000';

const { default: app } = await import('../index.js');

const server = app.listen(0);
await new Promise(resolve => server.once('listening', resolve));
const { port } = server.address();

const request = (method, path, { headers = {}, body } = {}) => new Promise((resolve, reject) =>
{
    const req = http.request({ host: '127.0.0.1', port, method, path, headers }, (res) =>
    {
        let data = '';
        res.on('data', chunk => (data += chunk));
        res.on('end', () =>
        {
            let json = null;
            try { json = JSON.parse(data); } catch { /* not json */ }
            resolve({ status: res.statusCode, headers: res.headers, json });
        });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
});

const results = [];
const check = async (name, fn) =>
{
    try
    {
        await fn();
        results.push(`ok   - ${name}`);
    }
    catch (error)
    {
        results.push(`FAIL - ${name}: ${error.message}`);
    }
};

await check('GET /api/saknly/v1/health -> 200 with db state', async () =>
{
    const res = await request('GET', '/api/saknly/v1/health');
    assert.equal(res.status, 200);
    assert.equal(res.json.success, true);
    assert.ok(typeof res.json.db === 'string');
});

await check('DB-backed route without a database -> 503 JSON', async () =>
{
    const res = await request('GET', '/api/saknly/v1/properties/allProperties');
    assert.equal(res.status, 503);
    assert.equal(res.json.success, false);
});

await check('disallowed CORS origin -> no CORS header, not 500', async () =>
{
    const res = await request('GET', '/api/saknly/v1/health', { headers: { Origin: 'https://evil.example' } });
    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], undefined);
});

await check('allowed CORS origin -> echoed', async () =>
{
    const res = await request('GET', '/api/saknly/v1/health', { headers: { Origin: 'http://localhost:3000' } });
    assert.equal(res.headers['access-control-allow-origin'], 'http://localhost:3000');
});

await check('removed debug route /api/saknly/v1/test -> not 200', async () =>
{
    const res = await request('GET', '/api/saknly/v1/test');
    assert.notEqual(res.status, 200);
});

server.close();
console.log(results.join('\n'));
const failed = results.filter(r => r.startsWith('FAIL')).length;
console.log(failed ? `\n${failed} check(s) failed` : '\nall smoke checks passed');
process.exit(failed ? 1 : 0);
