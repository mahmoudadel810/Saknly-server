import { describe, it, expect, vi, afterEach } from 'vitest';
import nodemailer from 'nodemailer';

vi.mock('nodemailer', () =>
{
    const createTransport = vi.fn(() => ({ sendMail: vi.fn(async () => ({ rejected: [] })) }));
    return { default: { createTransport }, createTransport };
});

const STALE_CLAIM_MS = 2 * 60 * 1000;
const ENV = ['EMAIL_SERVICE', 'EMAIL_SMTP_HOST', 'EMAIL_SMTP_USER', 'EMAIL_SMTP_PASS'];

// tests/setup.js mocks sendEmail everywhere; this file needs the real module
const realSendEmail = async () => (await vi.importActual('../services/sendEmail.js')).default;

describe('SMTP timeouts stay inside the stale-claim window', () =>
{
    afterEach(() => ENV.forEach((key) => delete process.env[key]));

    it.each([
        ['service transport', { EMAIL_SERVICE: 'gmail' }],
        ['host transport', { EMAIL_SMTP_HOST: 'smtp.example.test' }],
    ])('%s sets connection, greeting and socket timeouts', async (_, env) =>
    {
        Object.assign(process.env, env, { EMAIL_SMTP_USER: 'user', EMAIL_SMTP_PASS: 'pass' });
        await (await realSendEmail())({ to: 'a@example.test', subject: 's', message: 'm' });

        const options = nodemailer.createTransport.mock.calls.at(-1)[0];
        for (const key of ['connectionTimeout', 'greetingTimeout', 'socketTimeout'])
        {
            expect(options[key]).toBeGreaterThan(0);
            expect(options[key]).toBeLessThan(STALE_CLAIM_MS);
        }
    });
});
