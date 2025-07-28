import jwt from 'jsonwebtoken';

// In-memory token blacklist (can be replaced with Redis for production)
const tokenBlacklist = new Set();

export const tokenFunction = ({
    payload = {},
    secret = process.env.JWT_SECRET,
    expiresIn = process.env.JWT_EXPIRES_IN,
    generate = true
}) =>
{
    if (!secret)
    {
        throw new Error("JWT Secret is required");
    }

    // Generate token
    if (generate && typeof payload === "object")
    {
        if (Object.keys(payload).length > 0)
        {
            const token = jwt.sign(payload, secret, { expiresIn });
            return token;
        }
        return false;
    }

    // Decode/Verify token
    if (!generate && typeof payload === "string")
    {
        if (!payload)
        {
            return false;
        }
        try
        {
            // Check if token is blacklisted
            if (tokenBlacklist.has(payload))
            {
                return false;
            }

            const decoded = jwt.verify(payload, secret);
            return decoded;
        } catch (error)
        {
            return false;
        }
    }

    return false;
};

// Add a token to the blacklist
export const blacklistToken = (token) =>
{
    if (!token) return false;

    try
    {
        // Get token expiry to know when we can safely remove it
        const decoded = jwt.decode(token);
        const expiryTimestamp = decoded.exp * 1000; // Convert to milliseconds

        // Add to blacklist
        tokenBlacklist.add(token);

        // Set up automatic cleanup after token expires
        const timeToExpiry = expiryTimestamp - Date.now();
        if (timeToExpiry > 0)
        {
            setTimeout(() =>
            {
                tokenBlacklist.delete(token);
            }, timeToExpiry + 10000); // Add 10 seconds buffer
        }

        return true;
    } catch (error)
    {
        console.error('Error blacklisting token:', error);
        return false;
    }
};

// Check if a token is blacklisted
export const isTokenBlacklisted = (token) =>
{
    return tokenBlacklist.has(token);
};


