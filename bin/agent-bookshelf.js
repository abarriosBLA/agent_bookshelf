#!/usr/bin/env node

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const serverPath = join(__dirname, '..', 'src', 'server.ts');

execSync(`npx tsx "${serverPath}"`, {
  stdio: 'inherit',
  env: { ...process.env }
});
