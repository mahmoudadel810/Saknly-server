import { GoogleGenerativeAI } from "@google/generative-ai";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let genAI = null;

// Lazily create the client so a missing GEMINI_API_KEY doesn't crash the app at import time
export const getGeminiModel = () =>
{
    if (!process.env.GEMINI_API_KEY)
    {
        const error = new Error('GEMINI_API_KEY is not configured');
        error.code = 'GEMINI_NOT_CONFIGURED';
        throw error;
    }

    if (!genAI)
    {
        genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    }

    return genAI.getGenerativeModel({ model: GEMINI_MODEL });
};

export default getGeminiModel;
