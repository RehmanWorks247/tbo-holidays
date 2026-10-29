import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('reflect-metadata');
const { ConfigService } = require('@nestjs/config');
const { hotelSchema } = require('@hotel/contracts');
const { validateEnvironment } = require('../dist/config/environment.js');
const { TboClient } = require('../dist/modules/tbo/tbo.client.js');
const { CurrencyService } = require('../dist/modules/pricing/currency.service.js');
const { TboService } = require('../dist/modules/tbo/tbo.service.js');
const {
  tboCountriesResponseSchema,
  tboCitiesResponseSchema,
} = require('../dist/modules/tbo/dto/tbo-catalog.schemas.js');
const {
  tboCatalogResponseSchema,
  tboDetailsResponseSchema,
  tboSearchResponseSchema,
} = require('../dist/modules/tbo/dto/tbo.schemas.js');
const {
  mapCatalogHotel,
  mapHotelDetails,
  mapHotelRate,
} = require('../dist/modules/tbo/mappers/tbo-hotel.mapper.js');

// Explicit, read-only verification. No bookings, raw supplier payloads, tokens,
// credentials or guest data are written. This does not enable the running app.
let stage = 'configuration';
const started = Date.now();
function report(data) {
  process.stdout.write(`${JSON.stringify({ stage, ...data })}\n`);
}
try {
  const env = validateEnvironment({
    ...process.env,
    TBO_READS_ENABLED: 'true',
    HOTEL_DATA_MODE: 'live',
  });
  const config = new ConfigService(env);
  const client = new TboClient(config);
  const money = new CurrencyService();
  const countryCode = process.env.TBO_VERIFY_COUNTRY ?? 'AE';
  const cityName = process.env.TBO_VERIFY_CITY ?? 'Dubai';
  if (!/^[A-Z]{2}$/.test(countryCode)) throw new Error('Invalid verification country.');

  stage = 'countries';
  const countries = tboCountriesResponseSchema.parse(await client.read('CountryList', {}));
  if (!countries.CountryList.some((country) => country.Code === countryCode))
    throw new Error('Country unavailable.');
  report({ count: countries.CountryList.length });

  stage = 'cities';
  const cities = tboCitiesResponseSchema.parse(
    await client.read('CityList', { CountryCode: countryCode }),
  );
  const city = cities.CityList.find((item) => item.Name.toLowerCase() === cityName.toLowerCase());
  if (!city) throw new Error('Verification city unavailable.');
  report({ count: cities.CityList.length, destination: city.Name });

  stage = 'catalog';
  const catalog = tboCatalogResponseSchema.parse(
    await client.read('TBOHotelCodeList', { CityCode: city.Code, IsDetailedResponse: true }),
  );
  const hotels = catalog.Hotels.map((item) => hotelSchema.parse(mapCatalogHotel(item)));
  if (!hotels.length || new Set(hotels.map((hotel) => hotel.id)).size !== hotels.length)
    throw new Error('Invalid catalog identities.');
  report({
    count: hotels.length,
    withFacilities: hotels.filter((hotel) => hotel.facilities.length).length,
    withImages: hotels.filter((hotel) => hotel.images.length).length,
  });

  stage = 'details';
  const first = hotels[0];
  const details = tboDetailsResponseSchema.parse(
    await client.read('HotelDetails', { Hotelcodes: first.id, Language: 'EN' }),
  );
  if (details.HotelDetails.length !== 1 || details.HotelDetails[0].HotelCode !== first.id)
    throw new Error('Invalid details identity.');
  hotelSchema.parse(mapHotelDetails(details.HotelDetails[0]));
  report({ validated: true });

  stage = 'availability';
  const checkIn = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const checkOut = new Date(Date.now() + 32 * 86400000).toISOString().slice(0, 10);
  const codes = hotels.slice(0, 100).map((hotel) => hotel.id);
  const request = {
    CheckIn: checkIn,
    CheckOut: checkOut,
    HotelCodes: codes.join(','),
    GuestNationality: 'PK',
    PaxRooms: [{ Adults: 2, Children: 0, ChildrenAges: [] }],
    ResponseTime: 23,
    IsDetailedResponse: false,
    Filters: { MealType: 'All' },
  };
  const inventory = tboSearchResponseSchema.parse(await client.read('Search', request));
  const seen = new Set();
  const tokens = new Set();
  for (const hotel of inventory.HotelResult) {
    if (!codes.includes(hotel.HotelCode) || seen.has(hotel.HotelCode))
      throw new Error('Invalid search identity.');
    seen.add(hotel.HotelCode);
    for (const room of hotel.Rooms) {
      if (room.Name.length !== 1 || tokens.has(room.BookingCode))
        throw new Error('Invalid room identity.');
      tokens.add(room.BookingCode);
      mapHotelRate(room, hotel.HotelCode, hotel.Currency, money, hotel.RateConditions);
    }
  }
  report({
    hotelCount: inventory.HotelResult.length,
    rateCount: tokens.size,
    currencies: [...new Set(inventory.HotelResult.map((hotel) => hotel.Currency))],
    checkIn,
    checkOut,
  });
  const available = inventory.HotelResult.find((hotel) => hotel.Rooms.length);
  if (!available) throw new Error('No available sample rates; choose another city or retry.');

  stage = 'prebook';
  // Only the read service is used; its mutation methods remain disabled.
  const supplier = new TboService(client, money, {}, config);
  const rate = await supplier.recheckPrice(available.Rooms[0].BookingCode);
  if (rate.hotelId !== available.HotelCode || rate.price.currency !== available.Currency)
    throw new Error('Recheck identity changed.');
  report({
    validated: true,
    policyCount: rate.cancellationPolicies.length,
    durationMs: Date.now() - started,
  });
  report({
    result:
      'Read schemas validated. Pricing semantics and sales certification still require account confirmation.',
  });
} catch (error) {
  // Never print Error.message, Zod issues, fetch causes, headers or raw responses.
  const code =
    typeof error?.code === 'string' && /^[A-Z_]{2,80}$/.test(error.code)
      ? error.code
      : 'VERIFICATION_FAILED';
  process.stderr.write(`${JSON.stringify({ stage, code, durationMs: Date.now() - started })}\n`);
  process.exitCode = 1;
}
