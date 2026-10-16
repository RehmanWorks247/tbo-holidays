import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const child = spawn(
  process.execPath,
  [require.resolve('@nestjs/cli/bin/nest.js'), 'start', '--watch'],
  {
    stdio: 'inherit',
    env: {
      ...process.env,
      HOTEL_DATA_MODE: 'mock',
      HOST: '127.0.0.1',
      // Redis is validated but unused by the read-only database-backed runtime.
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:63799',
    },
  },
);
child.on('error', () => {
  process.stderr.write('Could not start the hotel preview API.\n');
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
