import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('reflect-metadata');
const { ConfigService } = require('@nestjs/config');
const Redis = require('ioredis');
const { validateEnvironment } = require('../dist/config/environment.js');
const { DatabaseService } = require('../dist/database/database.service.js');
const { TboClient } = require('../dist/modules/tbo/tbo.client.js');
const { TboCatalogService } = require('../dist/modules/tbo/tbo-catalog.service.js');

let database;
let redis;
try {
  const settings = validateEnvironment(process.env);
  if (!settings.TBO_READS_ENABLED || settings.HOTEL_DATA_MODE !== 'live') {
    throw new Error('CATALOG_READS_NOT_ENABLED');
  }
  const options = Object.fromEntries(
    process.argv.slice(2).map((argument) => {
      const match = /^--(countries|cities|force|all-cities|max-cities)(?:=(.*))?$/.exec(argument);
      if (!match) throw new Error('INVALID_CATALOG_ARGUMENT');
      return [match[1], match[2] ?? 'true'];
    }),
  );
  const config = new ConfigService(settings);
  database = new DatabaseService(config);
  redis = new Redis(settings.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    connectTimeout: 5000,
    retryStrategy: () => null,
  });
  redis.on('error', () => {
    /* Redis errors are reported by connect/command rejections. */
  });
  await database.$connect();
  await redis.connect();
  const catalog = new TboCatalogService(database, new TboClient(config), config, { client: redis });
  const countries = (options.countries ?? settings.TBO_CATALOG_COUNTRIES).split(',');
  const counts = await catalog.syncDestinations(countries, options.force === 'true');
  let cities = options.cities?.split(',') ?? [];
  if (options['all-cities'] === 'true') {
    const maximum = Number(options['max-cities'] ?? 100);
    if (!Number.isSafeInteger(maximum) || maximum < 1 || maximum > 100_000)
      throw new Error('INVALID_CATALOG_LIMIT');
    const selected = await database.tboDestination.findMany({
      where: { scope: catalog.scope, countryCode: { in: countries }, active: true },
      orderBy: [{ hotelsRefreshedAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
      select: { id: true },
      take: maximum,
    });
    cities = [...cities, ...selected.map((city) => city.id)];
  }
  let hotels = 0;
  const selectedCities = [...new Set(cities)];
  if (selectedCities.some((code) => !/^\d{1,16}$/.test(code)))
    throw new Error('INVALID_CATALOG_CITY');
  for (const city of selectedCities)
    hotels += await catalog.syncCity(city, options.force === 'true');
  process.stdout.write(
    JSON.stringify({
      countries: counts.countries,
      destinations: counts.destinations,
      citiesWarmed: selectedCities.length,
      hotels,
    }) + '\n',
  );
} catch (error) {
  const known = new Set([
    'CATALOG_READS_NOT_ENABLED',
    'INVALID_CATALOG_ARGUMENT',
    'INVALID_CATALOG_LIMIT',
    'INVALID_CATALOG_CITY',
  ]);
  const code =
    error &&
    typeof error === 'object' &&
    typeof error.code === 'string' &&
    /^[A-Z_]+$/.test(error.code)
      ? error.code
      : error instanceof Error && known.has(error.message)
        ? error.message
        : 'CATALOG_SYNC_FAILED';
  // Never print upstream bodies, raw exceptions, connection strings or credentials.
  process.stderr.write(
    `Catalogue synchronization failed (${code}). Check configuration, connectivity and migrations.\n`,
  );
  process.exitCode = 1;
} finally {
  redis?.disconnect();
  await database?.$disconnect();
}
