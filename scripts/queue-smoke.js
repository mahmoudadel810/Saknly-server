// End-to-end check against the local compose stack (docker compose up -d --build).
// Publishes one of each email event plus a duplicate message id, then counts what reached Mailpit.
//   RABBITMQ_URL=amqp://guest:guest@localhost:5672 node scripts/queue-smoke.js
import amqp from 'amqplib';
import { EXCHANGES } from '../services/queue/topology.js';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
const MAILPIT_URL = process.env.MAILPIT_URL || 'http://localhost:8025';
const run = Date.now();

const events = [
    ['user.registered', { email: `smoke-${run}@saknly.local`, userName: 'smoke', confirmationLink: 'http://localhost:3000/confirm-email/x' }],
    ['user.password_changed', { email: `smoke-${run}@saknly.local` }],
    ['property.approved', { propertyId: 'p1', title: 'Smoke flat', ownerName: 'Owner', contactEmail: `owner-${run}@saknly.local` }],
    ['property.denied', { propertyId: 'p2', title: 'Smoke villa', ownerName: 'Owner', contactEmail: `owner-${run}@saknly.local`, reason: 'blurry photos' }],
    ['inquiry.created', { propertyTitle: 'Smoke flat', agentEmail: `agent-${run}@saknly.local`, name: 'N', email: 'n@x.test', phone: '010', message: 'hi' }],
];

const mailCount = async () => (await (await fetch(`${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`saknly.local`)}`)).json()).messages_count;

const before = await mailCount();
const connection = await amqp.connect(RABBITMQ_URL);
const channel = await connection.createConfirmChannel();

const send = (type, data, messageId) => channel.publish(EXCHANGES.events, type,
    Buffer.from(JSON.stringify({ type, data, occurredAt: new Date().toISOString() })),
    { persistent: true, contentType: 'application/json', messageId, type, headers: { 'x-attempt': 1 } });

events.forEach(([type, data], i) => send(type, data, `smoke-${run}-${i}`));
// same message id again: the worker must skip it
send(events[0][0], events[0][1], `smoke-${run}-0`);
await channel.waitForConfirms();
await connection.close();

const expected = events.length;
let received = 0;
for (let i = 0; i < 30 && received < expected; i++)
{
    await new Promise(r => setTimeout(r, 1000));
    received = (await mailCount()) - before;
}
await new Promise(r => setTimeout(r, 2000)); // a duplicate would arrive by now
received = (await mailCount()) - before;

console.log(`published ${expected + 1} messages (1 duplicate), Mailpit received ${received}, expected ${expected}`);
process.exit(received === expected ? 0 : 1);
