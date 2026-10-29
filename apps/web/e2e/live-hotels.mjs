import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  hotelCatalogResponseSchema,
  hotelDestinationsResponseSchema,
  hotelSchema,
} from '@hotel/contracts';

const repository = fileURLToPath(new URL('../../../', import.meta.url));
const output = resolve(
  repository,
  process.env.E2E_OUTPUT_DIR ?? `test-results/hotel-live-e2e-${Date.now()}`,
);
const web = new URL(process.env.E2E_WEB_URL ?? 'http://localhost:3001');
const api = new URL(process.env.E2E_API_URL ?? 'http://localhost:4001/api/v1/');
if (!api.pathname.endsWith('/')) api.pathname += '/';
const timeout = Number(process.env.E2E_TIMEOUT_MS ?? 90_000);
const preflightOnly = process.argv.includes('--preflight-only');
const report = {
  version: 1,
  mode: preflightOnly ? 'preflight' : 'live-browser',
  startedAt: new Date().toISOString(),
  webOrigin: web.origin,
  apiOrigin: api.origin,
  checks: [],
  screenshots: [],
  success: false,
};
let browser;
let page;

class CheckFailure extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function check(name, run) {
  const started = Date.now();
  try {
    const metrics = await run();
    report.checks.push({ name, status: 'passed', durationMs: Date.now() - started, metrics });
    console.log(`PASS ${name}`);
  } catch (error) {
    const failure =
      error instanceof CheckFailure
        ? error
        : new CheckFailure('ASSERTION_FAILED', 'A required live hotel UI assertion failed.');
    report.checks.push({
      name,
      status: 'failed',
      durationMs: Date.now() - started,
      code: failure.code,
      message: failure.message,
    });
    console.error(`FAIL ${name}: ${failure.code}: ${failure.message}`);
    if (page)
      await screenshot(`${report.checks.length}-failure`).catch(() => {
        report.screenshotCaptureFailed = true;
      });
    throw failure;
  }
}

async function json(path, schema) {
  let response;
  try {
    response = await fetch(new URL(path, api), { signal: AbortSignal.timeout(20_000) });
  } catch (error) {
    const cause = error.cause?.code;
    const networkCode = ['EACCES', 'EPERM', 'ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT'].includes(
      cause,
    )
      ? cause
      : 'UNREACHABLE';
    throw new CheckFailure(
      'API_UNREACHABLE',
      `The running API could not be reached (${networkCode}).`,
    );
  }
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (
      path.startsWith('hotels/catalog') &&
      (response.status === 404 || payload?.code === 'INVALID_HOTEL_ID')
    )
      throw new CheckFailure(
        'CATALOG_ROUTE_MISSING',
        'The running API lacks the catalogue route; rebuild and restart it before live acceptance.',
      );
    if (['SUPPLIER_NOT_CONFIGURED', 'SUPPLIER_INTEGRATION_REQUIRED'].includes(payload?.code))
      throw new CheckFailure(
        'SUPPLIER_DISABLED',
        'Verified TBO reads must be enabled on the running API before live acceptance.',
      );
    throw new CheckFailure('API_REQUEST_FAILED', `The live API returned HTTP ${response.status}.`);
  }
  const parsed = schema.safeParse(payload?.data);
  if (!parsed.success)
    throw new CheckFailure(
      'INVALID_PUBLIC_RESPONSE',
      'The API did not return the expected public hotel contract.',
    );
  return parsed.data;
}

async function catalog(query = '', pageNumber = 1, pageSize = 20) {
  return json(
    `hotels/catalog?${new URLSearchParams({ query, page: String(pageNumber), pageSize: String(pageSize) })}`,
    hotelCatalogResponseSchema,
  );
}

async function screenshot(name) {
  const filename = `${name}.png`;
  await page.screenshot({ path: resolve(output, filename), fullPage: true });
  report.screenshots.push(filename);
}

async function visibleHotel() {
  await page.waitForFunction(
    () => {
      const section = document.querySelector('section[aria-label="Hotel catalogue"]');
      if (section?.querySelector('[role="alert"]')) return true;
      const link = section?.querySelector('article h2 a');
      if (!link) return false;
      // Card links carry their rendered query, even when TanStack serves cached data.
      // URL changes alone can occur before React commits the new catalogue cards.
      const rendered = new URL(link.href, location.href).searchParams;
      const current = new URL(location.href).searchParams;
      return (
        (rendered.get('destination') ?? '') === (current.get('destination') ?? '') &&
        (rendered.get('hotelId') ?? '') === (current.get('hotelId') ?? '') &&
        (rendered.get('page') ?? '1') === (current.get('page') ?? '1') &&
        (rendered.get('pageSize') ?? '20') === (current.get('pageSize') ?? '20')
      );
    },
    { timeout },
  );
  const visible = await page.evaluate(() => {
    const section = document.querySelector('section[aria-label="Hotel catalogue"]');
    if (section?.querySelector('[role="alert"]')) return null;
    const heading = section?.querySelector('article h2');
    return heading
      ? { id: heading.id.replace(/^hotel-/, ''), name: heading.textContent.trim() }
      : null;
  });
  if (!visible)
    throw new CheckFailure('LIVE_CATALOG_FAILED', 'The browser displayed a hotel catalogue error.');
  const hotel = await json(`hotels/${encodeURIComponent(visible.id)}`, hotelSchema);
  assert.equal(hotel.source, 'live');
  assert.equal(visible.name, hotel.name);
  return hotel;
}

async function search(query) {
  const selector = '[data-hotel-results] input[role="combobox"]';
  await page.waitForSelector(selector, { visible: true, timeout });
  await page.click(selector, { clickCount: 3 });
  await page.keyboard.press('Backspace');
  if (query) await page.type(selector, query);
  await page.click('[data-hotel-results] form button[type="submit"]');
  await page.waitForFunction(
    (destination) => (new URL(location.href).searchParams.get('destination') ?? '') === destination,
    { timeout },
    query,
  );
  return visibleHotel();
}

function mixedCase(value) {
  return [...value]
    .map((letter, index) => (index % 2 ? letter.toUpperCase() : letter.toLowerCase()))
    .join('');
}

async function browserModule() {
  const require = createRequire(import.meta.url);
  for (const candidate of [process.env.E2E_BROWSER_MODULE, 'puppeteer', 'puppeteer-core'].filter(
    Boolean,
  )) {
    try {
      const loaded = require(candidate);
      if (typeof loaded.launch === 'function') return loaded;
      if (typeof loaded.default?.launch === 'function') return loaded.default;
    } catch {
      // Try another installed package; never install or download a browser runtime.
    }
  }
  throw new CheckFailure(
    'BROWSER_RUNTIME_MISSING',
    'An installed Puppeteer package is required; set E2E_BROWSER_MODULE to its entry point. No dependency was downloaded.',
  );
}

try {
  await mkdir(output, { recursive: true });
  await check('configuration', async () => {
    assert.ok(Number.isInteger(timeout) && timeout >= 10_000 && timeout <= 300_000);
    assert.ok(
      [web, api].every(
        (url) => ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password,
      ),
    );
  });
  await check('live-api-preflight', async () => {
    // The catalogue probe identifies stale APIs that route /catalog to /:hotelId.
    const data = await catalog('', 1, 1);
    const destinations = await json('hotels/destinations', hotelDestinationsResponseSchema);
    if (destinations.source !== 'live')
      throw new CheckFailure('MOCK_INVENTORY', 'Live acceptance refuses the mock hotel API.');
    assert.equal(data.source, 'live');
    return { loadedHotels: data.total, syncing: data.syncing };
  });
  await check('web-preflight', async () => {
    let response;
    try {
      response = await fetch(new URL('/hotels', web), { signal: AbortSignal.timeout(20_000) });
    } catch {
      throw new CheckFailure('WEB_UNREACHABLE', 'The running frontend could not be reached.');
    }
    assert.ok(response.ok);
    await response.body?.cancel();
  });
  if (!preflightOnly) {
    await check('browser-runtime', async () => {
      const puppeteer = await browserModule();
      try {
        browser = await puppeteer.launch({
          headless: true,
          ...(process.env.E2E_BROWSER_EXECUTABLE
            ? { executablePath: process.env.E2E_BROWSER_EXECUTABLE }
            : {}),
        });
        page = await browser.newPage();
        await page.setViewport({ width: 1440, height: 1000 });
        page.setDefaultTimeout(timeout);
        await page.setExtraHTTPHeaders({ 'Accept-Language': 'en-GB,en;q=0.9' });
      } catch {
        throw new CheckFailure(
          'BROWSER_LAUNCH_FAILED',
          'The browser could not start; set E2E_BROWSER_EXECUTABLE to an installed Chrome or Chromium executable.',
        );
      }
    });
    await check('unfiltered-live-hotels', async () => {
      const params = new URLSearchParams({
        currency: 'USD',
        rooms: JSON.stringify([{ adults: 2, childrenAges: [] }]),
      });
      await page.goto(new URL(`/hotels?${params}`, web).href, {
        waitUntil: 'domcontentloaded',
        timeout,
      });
      await visibleHotel();
      assert.equal(await page.$eval('h1', (element) => element.textContent), 'All hotels');
      await screenshot('01-all-hotels');
    });
    let sample;
    await check('mixed-case-country-search', async () => {
      sample = await search(mixedCase(process.env.E2E_COUNTRY ?? 'Turkey'));
      const expected = await catalog(process.env.E2E_COUNTRY ?? 'Turkey', 1, 1);
      assert.ok(expected.hotels.length);
      assert.equal(sample.countryCode, expected.hotels[0].countryCode);
      await screenshot('02-country-search');
    });
    await check('mixed-case-city-search', async () => {
      if (!sample.city || sample.city.length < 2)
        throw new CheckFailure(
          'CITY_SAMPLE_MISSING',
          'The real country response did not provide a city to test.',
        );
      const expectedCity = sample.city;
      sample = await search(mixedCase(expectedCity).slice(0, 80));
      assert.equal(sample.city?.toLocaleLowerCase(), expectedCity.toLocaleLowerCase());
      await screenshot('03-city-search');
    });
    await check('mixed-case-hotel-name-search', async () => {
      const expectedName = sample.name;
      sample = await search(mixedCase(expectedName).slice(0, 80));
      assert.ok(
        sample.name.toLocaleLowerCase().includes(expectedName.slice(0, 80).toLocaleLowerCase()),
      );
      await screenshot('04-hotel-name-search');
    });
    await check('clear-search-restores-all-hotels', async () => {
      await search('');
      assert.equal(await page.$eval('h1', (element) => element.textContent), 'All hotels');
      await screenshot('05-cleared-search');
    });
    await check('live-pagination', async () => {
      const data = await catalog('', 1, 1);
      if (data.total < 2)
        throw new CheckFailure(
          'PAGINATION_DATA_MISSING',
          'At least two real loaded hotels are needed to verify pagination.',
        );
      await page.goto(new URL('/hotels?pageSize=1', web).href, {
        waitUntil: 'domcontentloaded',
        timeout,
      });
      await visibleHotel();
      await page.click('nav[aria-label="Hotel catalogue pages"] button[aria-label="Next page"]');
      await page.waitForFunction(() => new URL(location.href).searchParams.get('page') === '2', {
        timeout,
      });
      await page.waitForFunction(
        () =>
          document
            .querySelector('nav[aria-label="Hotel catalogue pages"]')
            ?.textContent.includes('Page 2 of'),
        { timeout },
      );
      await visibleHotel();
      await screenshot('06-pagination');
    });
    await check('real-hotel-details', async () => {
      const hotel = await visibleHotel();
      await page.click(`h2[id="hotel-${hotel.id}"] a`);
      await page.waitForFunction(
        (name) => document.querySelector('h1')?.textContent.includes(name),
        { timeout },
        hotel.name,
      );
      assert.ok(new URL(page.url()).pathname.endsWith(`/hotels/${hotel.id}`));
      await screenshot('07-hotel-details');
    });
  }
  report.success = true;
} catch {
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {
    report.browserCleanupFailed = true;
    report.success = false;
    process.exitCode = 1;
  });
  report.finishedAt = new Date().toISOString();
  await writeFile(resolve(output, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Report: ${resolve(output, 'report.json')}`);
}
