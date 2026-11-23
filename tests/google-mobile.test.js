import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import User from '../Model/UserModel.js';
import { verifyGoogleIdToken, googleAudiences } from '../services/googleIdToken.js';
import { getApp, API } from './helpers/app.js';
import { makeUser, auth } from './helpers/factories.js';

// Google itself is not called: the verifier returns whatever identity a test sets up.
vi.mock('../services/googleIdToken.js', () => ({
    verifyGoogleIdToken: vi.fn(),
    googleAudiences: vi.fn(() => ['web-client-id']),
}));

const ID_TOKEN = 'x'.repeat(40);
const identity = (overrides = {}) => ({
    googleId: 'google-sub-1',
    email: 'Sara.Google@Example.test',
    emailVerified: true,
    displayName: 'Sara Google',
    givenName: 'Sara',
    familyName: 'Google',
    ...overrides,
});
const signIn = async (body = { idToken: ID_TOKEN }) =>
{
    const app = await getApp();
    return request(app).post(`${API}/auth/google/mobile`).send(body);
};

beforeEach(() =>
{
    verifyGoogleIdToken.mockReset();
    googleAudiences.mockReturnValue(['web-client-id']);
});

describe('POST /auth/google/mobile', () =>
{
    it('creates a confirmed Google account on first sign-in and returns the login token and user', async () =>
    {
        verifyGoogleIdToken.mockResolvedValue(identity());
        const res = await signIn();

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            success: true,
            user: { userName: 'Sara Google', email: 'sara.google@example.test', role: 'user' },
        });
        expect(typeof res.body.token).toBe('string');
        expect(Object.keys(res.body.user).sort()).toEqual(['_id', 'email', 'role', 'userName']);

        const saved = await User.findOne({ email: 'sara.google@example.test' });
        expect(saved).toMatchObject({
            provider: 'google',
            googleId: 'google-sub-1',
            isConfirmed: true,
            status: 'active',
            firstName: 'Sara',
            lastName: 'Google',
        });
        expect(verifyGoogleIdToken).toHaveBeenCalledWith(ID_TOKEN);
    });

    it('returns a token the rest of the API accepts', async () =>
    {
        verifyGoogleIdToken.mockResolvedValue(identity());
        const { body } = await signIn();

        const app = await getApp();
        const me = await request(app).get(`${API}/auth/getMe`).set(auth(body.token));
        expect(me.status).toBe(200);
        expect(me.body.data.user.email).toBe('sara.google@example.test');
    });

    it('signs an existing Google account in again without creating another', async () =>
    {
        verifyGoogleIdToken.mockResolvedValue(identity());
        await signIn();
        const first = await User.findOne({ email: 'sara.google@example.test' });

        const again = await signIn();
        expect(again.status).toBe(200);
        expect(again.body.user._id).toBe(String(first._id));
        expect(await User.countDocuments({ email: 'sara.google@example.test' })).toBe(1);
        const second = await User.findOne({ _id: first._id });
        expect(second.lastLoginAt.getTime()).toBeGreaterThanOrEqual(first.lastLoginAt.getTime());
    });

    it('matches the email without regard to case', async () =>
    {
        await User.create({ userName: 'sara', email: 'sara.google@example.test', provider: 'google', googleId: 'google-sub-1', status: 'active', isConfirmed: true });
        verifyGoogleIdToken.mockResolvedValue(identity({ email: 'SARA.GOOGLE@EXAMPLE.TEST' }));

        const res = await signIn();
        expect(res.status).toBe(200);
        expect(await User.countDocuments()).toBe(1);
    });

    it('keeps the model limits for long names and builds a name when Google gives none', async () =>
    {
        verifyGoogleIdToken.mockResolvedValue(
            identity({ email: 'long@example.test', displayName: 'A'.repeat(60), givenName: 'B'.repeat(40), familyName: 'C'.repeat(40) }),
        );
        expect((await signIn()).status).toBe(200);
        const long = await User.findOne({ email: 'long@example.test' });
        expect(long.userName).toHaveLength(30);
        expect(long.firstName).toHaveLength(20);
        expect(long.lastName).toHaveLength(20);

        verifyGoogleIdToken.mockResolvedValue(
            identity({ email: 'ab@example.test', googleId: 'sub-2', displayName: undefined, givenName: undefined, familyName: undefined }),
        );
        expect((await signIn()).status).toBe(200);
        const bare = await User.findOne({ email: 'ab@example.test' });
        expect(bare.userName).toBe('ab_');
    });

    it('refuses with 409, and changes nothing, when the email belongs to a password account', async () =>
    {
        const local = await makeUser({ email: 'sara.google@example.test' });
        verifyGoogleIdToken.mockResolvedValue(identity());

        const res = await signIn();
        expect(res.status).toBe(409);
        expect(res.body.message).toMatch(/password/i);
        expect(res.body.token).toBeUndefined();
        const after = await User.findById(local._id);
        expect(after.provider).toBe('local');
        expect(after.googleId).toBeUndefined();
        expect(await User.countDocuments()).toBe(1);
    });

    it('refuses an inactive Google account', async () =>
    {
        await User.create({ userName: 'sara', email: 'sara.google@example.test', provider: 'google', googleId: 'google-sub-1', status: 'in-active', isConfirmed: true });
        verifyGoogleIdToken.mockResolvedValue(identity());

        const res = await signIn();
        expect(res.status).toBe(403);
        expect(res.body.token).toBeUndefined();
    });

    it('refuses with 401 when Google does not vouch for the email', async () =>
    {
        verifyGoogleIdToken.mockResolvedValue(identity({ emailVerified: false }));
        const res = await signIn();
        expect(res.status).toBe(401);
        expect(await User.countDocuments()).toBe(0);
    });

    it('refuses with 401 when the ID token is not valid, without saying why', async () =>
    {
        verifyGoogleIdToken.mockRejectedValue(new Error('Wrong recipient, payload audience != requiredAudience'));
        const res = await signIn();
        expect(res.status).toBe(401);
        expect(res.body.message).not.toMatch(/audience|recipient/i);
        expect(await User.countDocuments()).toBe(0);
    });

    it('answers 503 when Google sign-in is not configured', async () =>
    {
        googleAudiences.mockReturnValue([]);
        const res = await signIn();
        expect(res.status).toBe(503);
        expect(verifyGoogleIdToken).not.toHaveBeenCalled();
    });

    it.each([
        ['no body', {}],
        ['an empty token', { idToken: '' }],
        ['a token that is far too short', { idToken: 'abc' }],
        ['a token that is not a string', { idToken: { $ne: null } }],
        ['an enormous token', { idToken: 'x'.repeat(5000) }],
    ])('rejects %s with 400 before calling Google', async (_label, body) =>
    {
        const res = await signIn(body);
        expect(res.status).toBe(400);
        expect(verifyGoogleIdToken).not.toHaveBeenCalled();
    });
});
