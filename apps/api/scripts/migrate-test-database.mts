import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const url = process.env.TEST_DATABASE_URL;
if (!url || !new URL(url).pathname.toLowerCase().includes('test')) {
  throw new Error('TEST_DATABASE_URL must explicitly identify a dedicated test database.');
}
const cli = join(dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
const result = spawnSync(process.execPath, [cli, 'migrate', 'deploy'], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: url },
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
