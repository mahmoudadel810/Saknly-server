import { describe, it, expect } from 'vitest';
import request from 'supertest';
import User from '../Model/UserModel.js';
import sendEmail from '../services/sendEmail.js';
import { getApp, API } from './helpers/app.js';
import { makeUser, makeAdmin, tokenFor, auth, PASSWORD, confirmationTokenFrom, resetCodeFrom } from './helpers/factories.js';

const registerBody = (overrides = {}) => ({
    userName: 'newcomer',
    email: 'newcomer@example.test',
    password: PASSWORD,
    confirmPassword: PASSWORD,
    phone: '01098765432',
    address: 'Menouf',
    ...overrides,
});

const pastIat = () => Math.floor(Date.now() / 1000) - 10;

describe('register', () =>
{
    it('rejects a self-assigned role (mass assignment)', async () =>
    {
        const app = await getApp();
        const res = await request(app).post(`${API}/auth/register`).send(registerBody({ role: 'admin' }));
        expect(res.status).toBe(400);
        expect(await User.countDocuments()).toBe(0);
    });

    it('creates an unconfirmed, inactive user with a hashed password', async () =>
    {
        const app = await getApp();
        const res = await request(app).post(`${API}/auth/register`).send(registerBody());
        expect(res.status).toBe(201);
        expect(res.body.emailSent).toBe(true);
        expect(JSON.stringify(res.body)).not.toContain(PASSWORD);

        const user = await User.findOne({ email: 'newcomer@example.test' }).select('+password');
        expect(user.role).toBe('user');
        expect(user.isConfirmed).toBe(false);
        expect(user.status).toBe('in-active');
        expect(user.password).toMatch(/^\$2[aby]\$/);
        expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ to: 'newcomer@example.test' }));
    });

    it('still succeeds when the confirmation email cannot be sent', async () =>
    {
        const app = await getApp();
        sendEmail.mockRejectedValueOnce(new Error('smtp down'));
        const res = await request(app).post(`${API}/auth/register`).send(registerBody());
        expect(res.status).toBe(201);
        expect(res.body.emailSent).toBe(false);
        expect(await User.countDocuments({ email: 'newcomer@example.test' })).toBe(1);
    });

    it('rejects an email that already belongs to a confirmed account', async () =>
    {
        const app = await getApp();
        await makeUser({ email: 'taken@example.test' });
        const res = await request(app).post(`${API}/auth/register`).send(registerBody({ email: 'taken@example.test' }));
        expect(res.status).toBe(409);
    });

    it('re-registering an unconfirmed email does not replace the pending account (M3)', async () =>
    {
        const app = await getApp();
        await request(app).post(`${API}/auth/register`).send(registerBody()).expect(201);
        const original = await User.findOne({ email: 'newcomer@example.test' }).select('+password');
        const firstLink = confirmationTokenFrom(sendEmail.mock.calls[0]);

        const res = await request(app).post(`${API}/auth/register`)
            .send(registerBody({ password: 'Att4cker!x', confirmPassword: 'Att4cker!x', userName: 'attacker' }));
        expect(res.status).toBe(409);

        const after = await User.findOne({ email: 'newcomer@example.test' }).select('+password');
        expect(after._id.toString()).toBe(original._id.toString());
        expect(after.password).toBe(original.password);
        expect(after.userName).toBe(original.userName);

        // the victim's original link still works and the original password logs in
        await request(app).get(`${API}/auth/confirm-email/${firstLink}`).expect(200);
        await request(app).post(`${API}/auth/login`).send({ email: 'newcomer@example.test', password: PASSWORD }).expect(200);
        expect((await request(app).post(`${API}/auth/login`).send({ email: 'newcomer@example.test', password: 'Att4cker!x' })).status).toBe(400);
    });

    it('a confirmation token is not a bearer token', async () =>
    {
        const app = await getApp();
        await request(app).post(`${API}/auth/register`).send(registerBody()).expect(201);
        const confirmationJwt = confirmationTokenFrom(sendEmail.mock.calls[0]);
        expect(confirmationJwt).toBeTruthy();

        await request(app).get(`${API}/auth/confirm-email/${confirmationJwt}`).expect(200);
        const user = await User.findOne({ email: 'newcomer@example.test' });
        expect(user.isConfirmed).toBe(true);
        expect(user.status).toBe('active');

        const res = await request(app).get(`${API}/auth/getMe`).set(auth(confirmationJwt));
        expect(res.status).toBe(401);
    });
});

describe('login', () =>
{
    it('logs in a confirmed active user without leaking the password', async () =>
    {
        const app = await getApp();
        const user = await makeUser({ isLoggedIn: false });
        const res = await request(app).post(`${API}/auth/login`).send({ email: user.email, password: PASSWORD });
        expect(res.status).toBe(200);
        expect(res.body.token).toBeTruthy();
        expect(res.body.user.role).toBe('user');
        expect(res.body.user.password).toBeUndefined();
        expect(JSON.stringify(res.body)).not.toContain('$2');

        const me = await request(app).get(`${API}/auth/getMe`).set(auth(res.body.token));
        expect(me.status).toBe(200);
        expect(me.body.data.user.password).toBeUndefined();
    });

    it('gives a generic 400 for a wrong password or unknown email', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        const wrong = await request(app).post(`${API}/auth/login`).send({ email: user.email, password: 'Wr0ng!pass' });
        const unknown = await request(app).post(`${API}/auth/login`).send({ email: 'nobody@example.test', password: PASSWORD });
        expect(wrong.status).toBe(400);
        expect(unknown.status).toBe(400);
        expect(wrong.body.message).toBe(unknown.body.message);
    });

    it('refuses unconfirmed, inactive and Google-only accounts', async () =>
    {
        const app = await getApp();
        const unconfirmed = await makeUser({ isConfirmed: false, status: 'in-active' });
        const inactive = await makeUser({ status: 'in-active' });
        const google = await User.create({ userName: 'googler', email: 'g@example.test', provider: 'google', googleId: 'g-1', status: 'active', isConfirmed: true });

        const r1 = await request(app).post(`${API}/auth/login`).send({ email: unconfirmed.email, password: PASSWORD });
        const r2 = await request(app).post(`${API}/auth/login`).send({ email: inactive.email, password: PASSWORD });
        const r3 = await request(app).post(`${API}/auth/login`).send({ email: google.email, password: PASSWORD });
        expect(r1.status).toBe(403);
        expect(r2.status).toBe(403);
        expect(r3.status).toBe(400);
    });
});

describe('logout and token revocation', () =>
{
    it('logout revokes tokens on every instance via lastLogoutAt', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        const token = tokenFor(user);
        // Simulates a token held by another serverless instance (not in this instance's blacklist)
        const olderToken = tokenFor(user, { iat: pastIat() });

        await request(app).post(`${API}/auth/logout`).set(auth(token)).expect(200);

        const fresh = await User.findById(user._id);
        expect(fresh.isLoggedIn).toBe(false);
        expect(fresh.lastLogoutAt).toBeInstanceOf(Date);

        expect((await request(app).get(`${API}/auth/getMe`).set(auth(token))).status).toBe(401);
        expect((await request(app).get(`${API}/auth/getMe`).set(auth(olderToken))).status).toBe(401);
        expect((await request(app).post(`${API}/auth/refresh-token`).set(auth(olderToken))).status).toBe(401);
    });

    it('refresh works for a live session', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        const res = await request(app).post(`${API}/auth/refresh-token`).set(auth(tokenFor(user)));
        expect(res.status).toBe(200);
        expect(res.body.token).toBeTruthy();
        expect((await request(app).get(`${API}/auth/getMe`).set(auth(res.body.token))).status).toBe(200);
    });

    it('deactivation and role change revoke existing tokens', async () =>
    {
        const app = await getApp();
        const admin = await makeAdmin();
        const adminToken = tokenFor(admin);
        const u1 = await makeUser();
        const u2 = await makeUser();
        const t1 = tokenFor(u1);
        const t2 = tokenFor(u2);

        await request(app).put(`${API}/users/update-user/${u1._id}`).set(auth(adminToken)).send({ status: 'in-active' }).expect(200);
        await request(app).put(`${API}/users/update-user/${u2._id}`).set(auth(adminToken)).send({ role: 'admin' }).expect(200);

        expect((await request(app).get(`${API}/auth/getMe`).set(auth(t1))).status).toBe(401);
        expect((await request(app).get(`${API}/auth/getMe`).set(auth(t2))).status).toBe(401);
    });
});

describe('refresh-token accepts only access tokens (H1)', () =>
{
    it('an email-confirmation token cannot be exchanged for a session', async () =>
    {
        const app = await getApp();
        await request(app).post(`${API}/auth/register`).send(registerBody()).expect(201);
        const confirmationJwt = confirmationTokenFrom(sendEmail.mock.calls[0]);
        await request(app).get(`${API}/auth/confirm-email/${confirmationJwt}`).expect(200);
        await request(app).post(`${API}/auth/login`).send({ email: 'newcomer@example.test', password: PASSWORD }).expect(200);

        const res = await request(app).post(`${API}/auth/refresh-token`).set(auth(confirmationJwt));
        expect(res.status).toBe(401);
        expect(res.body.token).toBeUndefined();
    });

    it('a token without the access-token role claim, or with a stale role, is refused', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        const { tokenFunction } = await import('../utils/tokenFunction.js');
        const noRole = tokenFunction({ payload: { id: user._id, email: user.email } });
        const staleRole = tokenFor(user, { role: 'admin' });
        const purpose = tokenFor(user, { purpose: 'email-confirmation' });

        for (const token of [noRole, staleRole, purpose])
        {
            expect((await request(app).post(`${API}/auth/refresh-token`).set(auth(token))).status).toBe(401);
        }
        // a normal session still refreshes
        expect((await request(app).post(`${API}/auth/refresh-token`).set(auth(tokenFor(user)))).status).toBe(200);
    });
});

describe('password reset', () =>
{
    const requestCode = async (app, email) =>
    {
        const res = await request(app).post(`${API}/auth/forgot-password`).send({ email });
        expect(res.status).toBe(200);
        const call = sendEmail.mock.calls.at(-1);
        const code = resetCodeFrom(call);
        expect(code).toHaveLength(6);
        expect(JSON.stringify(res.body)).not.toContain(code);
        return { code, call };
    };

    const resetBody = (email, code, newPassword = 'N3w!Passw') => ({ email, code, newPassword, confirmNewPassword: newPassword });

    it('resets with email + code once, ends existing sessions, never returns the code', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        const oldToken = tokenFor(user, { iat: pastIat() });

        const { code, call } = await requestCode(app, user.email);
        expect(call[0].to).toBe(user.email);

        // Code is bound to the email
        const other = await makeUser();
        expect((await request(app).post(`${API}/auth/reset-password`).send(resetBody(other.email, code))).status).toBe(400);

        const ok = await request(app).post(`${API}/auth/reset-password`).send(resetBody(user.email, code));
        expect(ok.status).toBe(200);
        expect(JSON.stringify(ok.body)).not.toContain(code);

        expect((await request(app).get(`${API}/auth/getMe`).set(auth(oldToken))).status).toBe(401);
        expect((await request(app).post(`${API}/auth/login`).send({ email: user.email, password: 'N3w!Passw' })).status).toBe(200);

        // Single use
        expect((await request(app).post(`${API}/auth/reset-password`).send(resetBody(user.email, code, 'An0ther!pw'))).status).toBe(400);
    });

    it('rejects and clears an expired code', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        const { code } = await requestCode(app, user.email);
        await User.updateOne({ _id: user._id }, { $set: { resetPasswordTokenExpiresIn: new Date(Date.now() - 1000) } });

        const res = await request(app).post(`${API}/auth/reset-password`).send(resetBody(user.email, code));
        expect(res.status).toBe(400);
        const stored = await User.findById(user._id).select('+resetPasswordToken');
        expect(stored.resetPasswordToken).toBeUndefined();
    });

    it('does not reveal whether an email is registered', async () =>
    {
        const app = await getApp();
        const user = await makeUser();
        const known = await request(app).post(`${API}/auth/forgot-password`).send({ email: user.email });
        const unknown = await request(app).post(`${API}/auth/forgot-password`).send({ email: 'ghost@example.test' });
        expect(unknown.status).toBe(200);
        expect(unknown.body).toEqual(known.body);
    });

    it('reset secrets are never returned by user endpoints', async () =>
    {
        const app = await getApp();
        const admin = await makeAdmin();
        const user = await makeUser();
        await requestCode(app, user.email);

        const me = await request(app).get(`${API}/auth/getMe`).set(auth(tokenFor(user)));
        const list = await request(app).get(`${API}/users/get-all-users`).set(auth(tokenFor(admin)));
        for (const body of [me.body, list.body])
        {
            expect(JSON.stringify(body)).not.toMatch(/resetPasswordToken|"password"/);
        }
    });
});
