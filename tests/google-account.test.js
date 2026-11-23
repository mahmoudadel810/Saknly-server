import { describe, it, expect } from 'vitest';
import User from '../Model/UserModel.js';
import { findOrCreateGoogleUser } from '../modules/Auth/googleAccount.js';
import { makeUser } from './helpers/factories.js';

// The rules shared by the browser flow (passport callback) and the mobile route. The browser callback
// turns `failure` into ?error=<code> on the client login page, so these codes are part of its contract.
const profile = (overrides = {}) => ({
    email: 'Sara@Example.test',
    googleId: 'g-1',
    displayName: 'Sara Ali',
    givenName: 'Sara',
    familyName: 'Ali',
    ...overrides,
});

describe('findOrCreateGoogleUser', () =>
{
    it('creates a confirmed, active Google user with a lower-cased email', async () =>
    {
        const { user, failure } = await findOrCreateGoogleUser(profile());
        expect(failure).toBeUndefined();
        expect(user).toMatchObject({ email: 'sara@example.test', provider: 'google', googleId: 'g-1', isConfirmed: true, status: 'active' });
    });

    it('returns the existing Google user instead of creating another', async () =>
    {
        const first = await findOrCreateGoogleUser(profile());
        const again = await findOrCreateGoogleUser(profile({ email: 'SARA@example.test' }));
        expect(String(again.user._id)).toBe(String(first.user._id));
        expect(await User.countDocuments()).toBe(1);
    });

    it('fails with google_failed when there is no email', async () =>
    {
        expect(await findOrCreateGoogleUser(profile({ email: undefined }))).toEqual({ failure: 'google_failed' });
        expect(await findOrCreateGoogleUser(profile({ email: '' }))).toEqual({ failure: 'google_failed' });
        expect(await User.countDocuments()).toBe(0);
    });

    it('fails with email_already_registered for a password account, and leaves it alone', async () =>
    {
        const local = await makeUser({ email: 'sara@example.test' });
        expect(await findOrCreateGoogleUser(profile())).toEqual({ failure: 'email_already_registered' });
        const after = await User.findById(local._id);
        expect(after.provider).toBe('local');
        expect(after.googleId).toBeUndefined();
    });

    it('fails with google_failed for an inactive Google account', async () =>
    {
        await User.create({ userName: 'sara', email: 'sara@example.test', provider: 'google', googleId: 'g-1', status: 'in-active', isConfirmed: true });
        expect(await findOrCreateGoogleUser(profile())).toEqual({ failure: 'google_failed' });
    });
});
