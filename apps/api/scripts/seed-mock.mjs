import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('@prisma/client');
const { seedMockHotelInventory } = require('../dist/modules/hotels/mock-hotel.seed.js');

// The command is explicitly named mock; production and remote DBs are still rejected.
const options = {
  nodeEnv: process.env.NODE_ENV,
  mode: 'mock',
  databaseUrl: process.env.DATABASE_URL,
};
const database = new PrismaClient({ datasourceUrl: options.databaseUrl });
try {
  const counts = await seedMockHotelInventory(database, options);
  process.stdout.write(
    `Preview inventory saved: ${counts.destinations} destinations, ${counts.hotels} hotels, ${counts.rates} rates.\n`,
  );
} catch {
  process.stderr.write(
    'Preview seed failed. Check local non-production database configuration and migrations. Existing real data was not modified.\n',
  );
  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
