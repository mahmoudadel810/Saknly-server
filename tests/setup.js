// Runs before every test file: mocks external services, starts an in-memory MongoDB
// and points the app at it. The app itself is imported lazily (tests/helpers/app.js).
import { vi, beforeAll, afterEach, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

// Email: never sends; tests read the message from sendEmail.mock.calls
vi.mock('../services/sendEmail.js', () => ({ default: vi.fn(async () => true) }));

// Cloudinary SDK (package level) so the real services/cloudinary.js helpers run against the fake
vi.mock('cloudinary', () =>
{
    let counter = 0;
    const fake = {
        config: vi.fn(),
        url: vi.fn((id) => `https://res.cloudinary.test/${id}`),
        uploader: {
            upload_stream: vi.fn((options, cb) => ({
                end: (buffer) =>
                {
                    counter += 1;
                    const public_id = `${options?.folder || 'saknly'}/test-${counter}`;
                    cb(null, {
                        secure_url: `https://res.cloudinary.test/${public_id}`,
                        public_id,
                        resource_type: 'image',
                        format: 'jpg',
                        bytes: buffer?.length || 0,
                        width: 1,
                        height: 1,
                    });
                },
            })),
            upload: vi.fn(async () => ({})),
            destroy: vi.fn(async () => ({ result: 'ok' })),
            explicit: vi.fn(async () => ({})),
        },
        api: {
            delete_resources: vi.fn(async () => ({ deleted: {} })),
        },
    };
    return { v2: fake, default: { v2: fake } };
});

// Gemini: tests drive the model through __generateContent
vi.mock('../modules/chatBot/geminiClient.js', () =>
{
    const generateContent = vi.fn(async () => ({ response: { text: async () => 'property' } }));
    const getGeminiModel = vi.fn(() => ({ generateContent }));
    return { GEMINI_MODEL: 'test-model', getGeminiModel, default: getGeminiModel, __generateContent: generateContent };
});

let mongod;

beforeAll(async () =>
{
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    // Guard: a test run must never reach a real database (seed-like cleanup below wipes collections)
    if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri))
    {
        throw new Error(`Refusing to run tests against a non-local MongoDB URI`);
    }
    process.env.MONGODB_URI = uri;
    process.env.DB_NAME = 'saknly-test';

    await mongoose.connect(uri, { dbName: process.env.DB_NAME });
});

afterEach(async () =>
{
    // deleteMany (not dropDatabase) so unique indexes survive between tests
    for (const collection of Object.values(mongoose.connection.collections))
    {
        await collection.deleteMany({});
    }
    vi.clearAllMocks();
});

afterAll(async () =>
{
    await mongoose.disconnect();
    await mongod?.stop();
});
