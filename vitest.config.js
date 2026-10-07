import { defineConfig } from 'vitest/config';

// One file at a time, one in-memory mongod per file (shared machine: never run suites in parallel)
export default defineConfig({
    test: {
        environment: 'node',
        pool: 'forks',
        fileParallelism: false,
        include: ['tests/**/*.test.js'],
        setupFiles: ['./tests/setup.js'],
        testTimeout: 20000,
        hookTimeout: 120000,
        // morgan/winston are noisy; keep their output only for failing tests
        silent: 'passed-only',
        env: {
            MONGOMS_VERSION: '8.2.6',
            NODE_ENV: 'test',
            VERCEL: '1',
            JWT_SECRET: 'vitest-only-jwt-secret',
            BEARER_KEY: 'Saknly__',
            CLIENT_URL: 'http://localhost:3000',
            SALT_ROUNDS: '8',
            WHITELISTED_IPS: '127.0.0.1,::ffff:127.0.0.1,::1',
            GOOGLE_CLIENT_ID: '',
            GOOGLE_CLIENT_SECRET: '',
            GEMINI_API_KEY: '',
        },
    },
});
