import userModel from '../../Model/UserModel.js';

const truncate = (value, max) => (value || '').trim().slice(0, max);

/**
 * Finds or creates the account for a verified Google identity. Shared by the browser flow
 * (passport callback) and the mobile flow (POST /auth/google/mobile) so both apply the same rules.
 *
 * Resolves to { user } on success, or { failure } where failure is the reason code the web
 * client already understands: 'email_already_registered' (the email belongs to a password
 * account) or 'google_failed' (no email, or the account is not active).
 */
export const findOrCreateGoogleUser = async ({ email: rawEmail, googleId, displayName, givenName, familyName }) =>
{
    const email = rawEmail?.toLowerCase();
    if (!email)
    {
        return { failure: 'google_failed' };
    }

    const user = await userModel.findOne({ email });

    if (user)
    {
        if (user.provider === 'local')
        {
            return { failure: 'email_already_registered' };
        }
        if (user.status !== 'active')
        {
            return { failure: 'google_failed' };
        }
        user.isLoggedIn = true;
        user.lastLoginAt = new Date();
        await user.save();
        return { user };
    }

    // Respect the model's max lengths (userName 30, firstName/lastName 20)
    const name = (displayName || email.split('@')[0]).trim();
    const nameParts = name.split(/\s+/);
    const firstName = truncate(givenName || nameParts[0], 20);
    const lastName = truncate(familyName || nameParts.slice(1).join(' ') || firstName, 20);
    let userName = truncate(name, 30);
    if (userName.length < 3)
    {
        userName = truncate(email.split('@')[0].padEnd(3, '_'), 30);
    }

    const newUser = await userModel.create({
        firstName,
        lastName,
        userName,
        email,
        provider: 'google',
        googleId,
        isConfirmed: true,
        isLoggedIn: true,
        lastLoginAt: new Date(),
        status: 'active',
    });

    return { user: newUser };
};
