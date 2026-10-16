import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { prepareMockHotelInventory } = require('../dist/modules/hotels/mock-hotel.seed.js');
const options = {
  nodeEnv: process.env.NODE_ENV,
  mode: 'mock',
  databaseUrl: process.env.DATABASE_URL,
};
const database = new PrismaClient({ datasourceUrl: options.databaseUrl });
try {
  const counts = await prepareMockHotelInventory(database, options, async () => {
    const cli = join(dirname(require.resolve('prisma/package.json')), 'build', 'index.js');
    const migration = spawnSync(process.execPath, [cli, 'migrate', 'deploy'], {
      stdio: 'inherit',
      env: process.env,
    });
    if (migration.error || migration.status !== 0) throw new Error('Preview migration failed.');
  });
  process.stdout.write(
    `Preview database ready: ${counts.destinations} destinations, ${counts.hotels} hotels, ${counts.rates} rates.\n`,
  );
} catch {
  process.stderr.write(
    'Preview setup failed. Use a local development/test PostgreSQL database and check its availability. No database reset was attempted.\n',
  );
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
