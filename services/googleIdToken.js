import { OAuth2Client } from 'google-auth-library';

const client = new OAuth2Client();

/**
 * Client IDs whose ID tokens are accepted. The mobile app signs in with the web client's ID as
 * the token audience (GOOGLE_CLIENT_ID); GOOGLE_MOBILE_CLIENT_IDS adds more, comma separated.
 */
export const googleAudiences = () =>
    [process.env.GOOGLE_CLIENT_ID, ...(process.env.GOOGLE_MOBILE_CLIENT_IDS || '').split(',')]
        .map((id) => (id || '').trim())
        .filter(Boolean);

/**
 * Verifies a Google ID token (signature, expiry, issuer and audience) and returns the identity in it.
 * Rejects when the token is not valid.
 */
export const verifyGoogleIdToken = async (idToken) =>
{
    const ticket = await client.verifyIdToken({ idToken, audience: googleAudiences() });
    const payload = ticket.getPayload();
    return {
        googleId: payload.sub,
        email: payload.email,
        emailVerified: payload.email_verified === true,
        displayName: payload.name,
        givenName: payload.given_name,
        familyName: payload.family_name,
    };
};
