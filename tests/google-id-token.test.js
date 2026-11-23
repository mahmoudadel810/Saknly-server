import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const verifyIdToken = vi.fn();
vi.mock('google-auth-library', () => ({
    OAuth2Client: vi.fn(function ()
    {
        this.verifyIdToken = verifyIdToken;
    }),
}));

const { googleAudiences, verifyGoogleIdToken } = await import('../services/googleIdToken.js');

const saved = { ...process.env };
beforeEach(() =>
{
    verifyIdToken.mockReset();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_MOBILE_CLIENT_IDS;
});
afterEach(() =>
{
    process.env.GOOGLE_CLIENT_ID = saved.GOOGLE_CLIENT_ID;
    process.env.GOOGLE_MOBILE_CLIENT_IDS = saved.GOOGLE_MOBILE_CLIENT_IDS;
    if (saved.GOOGLE_CLIENT_ID === undefined) delete process.env.GOOGLE_CLIENT_ID;
    if (saved.GOOGLE_MOBILE_CLIENT_IDS === undefined) delete process.env.GOOGLE_MOBILE_CLIENT_IDS;
});

describe('googleAudiences', () =>
{
    it('is empty when nothing is configured', () =>
    {
        expect(googleAudiences()).toEqual([]);
    });

    it('starts with the web client ID and adds the extra ones, trimmed', () =>
    {
        process.env.GOOGLE_CLIENT_ID = ' web.apps.googleusercontent.com ';
        process.env.GOOGLE_MOBILE_CLIENT_IDS = 'android.apps.googleusercontent.com, ios.apps.googleusercontent.com ,,';
        expect(googleAudiences()).toEqual([
            'web.apps.googleusercontent.com',
            'android.apps.googleusercontent.com',
            'ios.apps.googleusercontent.com',
        ]);
    });
});

describe('verifyGoogleIdToken', () =>
{
    it('asks Google to check the token against the configured audiences and returns the identity', async () =>
    {
        process.env.GOOGLE_CLIENT_ID = 'web.apps.googleusercontent.com';
        verifyIdToken.mockResolvedValue({
            getPayload: () => ({
                sub: '123',
                email: 'a@example.test',
                email_verified: true,
                name: 'A B',
                given_name: 'A',
                family_name: 'B',
            }),
        });

        const result = await verifyGoogleIdToken('the-token');

        expect(verifyIdToken).toHaveBeenCalledWith({ idToken: 'the-token', audience: ['web.apps.googleusercontent.com'] });
        expect(result).toEqual({
            googleId: '123',
            email: 'a@example.test',
            emailVerified: true,
            displayName: 'A B',
            givenName: 'A',
            familyName: 'B',
        });
    });

    it('treats anything but a literal true email_verified as unverified', async () =>
    {
        process.env.GOOGLE_CLIENT_ID = 'web';
        for (const value of ['true', 1, undefined])
        {
            verifyIdToken.mockResolvedValue({ getPayload: () => ({ sub: '1', email: 'a@example.test', email_verified: value }) });
            expect((await verifyGoogleIdToken('t')).emailVerified).toBe(false);
        }
    });

    it('lets a rejected token reject', async () =>
    {
        process.env.GOOGLE_CLIENT_ID = 'web';
        verifyIdToken.mockRejectedValue(new Error('Token used too late'));
        await expect(verifyGoogleIdToken('t')).rejects.toThrow('Token used too late');
    });
});
