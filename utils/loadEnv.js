import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Loads environment variables before any other module reads them.
// Import this file FIRST (ESM evaluates imports in order).
// Precedence: real environment > root .env > config/.env
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

dotenv.config({ path: path.join(rootDir, '.env') });

const legacyEnvPath = path.join(rootDir, 'config', '.env');
if (fs.existsSync(legacyEnvPath))
{
    dotenv.config({ path: legacyEnvPath });
}
