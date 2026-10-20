# Hotel results and development preview

The `/hotels` page uses the NestJS API for destination discovery, inventory,
prices, filters, sorting and pagination. Mock data lives only in the backend.
The frontend uses the same Zod response contracts in preview and live mode.

## Start the preview

Set up root `.env` from `.env.example` and the web environment as described in the
README. Start local PostgreSQL, then prepare the catalogue and run the preview:

```sh
pnpm infra:up
pnpm db:prepare:mock
pnpm dev:mock
```

Open `http://localhost:3000/hotels`. If the web app is already running, start only
the API with `pnpm --filter @hotel/api dev:mock`. Ports default to 3000 and 4000;
`NEXT_PUBLIC_API_URL` in the web environment must point to that API's `/api/v1`
prefix. `WEB_ORIGIN` in the root environment must match the actual web origin
(for example `http://localhost:3000`) for browser API requests to work. When the
preview binds to IPv4 on Windows, use `http://127.0.0.1:4000/api/v1` as the public
API URL to avoid IPv6 localhost connection failures. PostgreSQL is required; Redis
is not used by the preview. The prepare
command generates Prisma Client, builds shared contracts and the API, validates
the local development database target, applies checked-in migrations and seeds
the mock catalogue. Subsequent `pnpm dev:mock` starts use the saved database rows.

The API script explicitly selects `HOTEL_DATA_MODE=mock`. The standard API entry
point then selects `MockAppModule`, which shares the existing hotel controller,
validation, error envelopes, request IDs, CORS and throttling. It connects the
shared Prisma database module but does not connect Redis or mount
booking/payment/job modules. Mock mode is
rejected when `NODE_ENV=production`; normal startup defaults to `live`.
No supplier or payment credentials are needed, and no TBO requests are made.

The launcher reads the configured `DATABASE_URL`; it never silently falls back to
in-memory fixtures when PostgreSQL is unavailable. The mock setup and seed
commands reject remote database hosts and require `NODE_ENV=development` or
`test`. The normal application still defaults to live mode.

To restore the supplied mock catalogue, run `pnpm db:seed:mock` after initial
preparation. It performs atomic upserts by stable IDs, so rerunning it updates
seeded sample rows without duplicates. It does not delete rows or write to user,
quote, booking or payment tables. Local edits to seeded mock rows are overwritten
by reseeding; additional mock rows are preserved. The seed is explicit and never
runs on API startup.

### Local PostgreSQL on this Windows workspace

This workspace also has an official PostgreSQL 17.11 portable installation under
the ignored `.local/postgres/` directory, because Docker Desktop was unavailable.
It listens only on `127.0.0.1:54329` and keeps durable data in
`.local/postgres/data`. It uses the existing local database credentials and has
separate `hotel_platform` and `hotel_platform_test` databases.

After rebooting this PC, start it from the repository root with
`& ./.local/postgres/start.ps1`; stop it gracefully with
`& ./.local/postgres/stop.ps1`. These helpers and the portable installation are
local to this checkout; new checkouts should use the normal Docker setup above.
Do not run the Docker PostgreSQL container and this instance on the same port.
Use `127.0.0.1` in both database URLs to match the IPv4 listener and avoid Windows
`localhost` IPv6 connection delays. Removing `.local/postgres/data` loses this
local database; it is not a disposable build cache.

## Inventory and prices

`apps/api/src/modules/hotels/mock-hotel.inventory.ts` is seed input for 45 hotels:
26 in Dubai, six in London, seven in Antalya and six in Bali. Runtime inventory
comes from the `MockDestination`, `MockHotel` and `MockRate` PostgreSQL tables. Foreign keys,
unique hotel/currency/board combinations and price/rating checks protect those
records. Every property name, score, review count,
rate and offer is fictional. Neighbourhoods and destination names provide
realistic geographic context. Photos are generic stock imagery, not evidence of
any property's actual appearance; provenance is in [image sources](image-sources.md).

Every destination includes one- through five-star properties and review scores
below 7, between 7 and 8, between 8 and 9, and above 9, so each star and guest-rating
filter has meaningful sample matches. One- and two-star properties have basic
facilities; properties also vary in type, area, distance to the beach, facilities
and board basis. Room options include room-only, breakfast and all-inclusive
where appropriate. Rates vary deterministically with dates,
weekends, rooms, adults and children, using checked integer minor-unit arithmetic.
Six currencies have separately stored nightly rates generated from explicit
sample pricing factors, not live exchange rates.
Fixture totals have zero markup and do not simulate the live markup configuration.
Policies and charges are generated consistently with the selected dates. Preview
rates cannot be rechecked into an owned quote, booked or paid for; live recheck
also rejects mock rate identifiers before accessing Redis.

After the API reports `source: mock`, an empty `/hotels` URL or an empty search
shows all 45 hotels across all destinations. No destination, dates, nationality or
guest entry is required. The form and URL retain omitted criteria; filter-only
links also work. A destination or other valid optional criterion narrows the search.
Invalid supplied values still show a validation/recovery state. Live mode continues
to require complete stay criteria.

The backend supplies a sample stay for pricing when criteria are omitted: 30 days
ahead, seven nights (capped by `MAX_STAY_NIGHTS`), one room with two adults,
nationality code `GB`, and the requested currency (USD by default). The nationality
is a sample pricing input, not a claim about the visitor. With only check-in given,
the sample duration follows that date; with only check-out given, it precedes that
date and is shortened if needed to avoid starting in the past. Invalid or past
explicit stays are rejected. The effective sample stay is returned as
`metadata.previewStay` so cards and room details can explain their sample totals.

## API and URL behavior

- `GET /api/v1/hotels/destinations`: `{ source, destinations }`; named mock
  destinations in preview, an empty list in live mode until catalogue lookup exists.
- `GET /api/v1/hotels/search`: base stay fields plus `rooms` JSON, optional
  `filters` JSON, `sort`, `page` and `pageSize`. In mock mode all stay fields are
  optional; no query string or `filters={}` returns the complete mock catalogue.
  Live mode uses the existing strict search contract.
- `GET /api/v1/hotels/:id`: property details, including `source: mock` for fixtures.
- `POST /api/v1/hotels/recheck`: explicitly unavailable in preview.

Filter fields are `name`, `minPrice`, `maxPrice`, `starRatings`, `minReviewScore`,
`facilities`, `mealTypes`, `refundable`, `propertyTypes`, `neighbourhoods`, and
`maxBeachDistance` (metres). Budgets use the whole stay and all requested rooms,
in the selected currency's minor units. Selections within stars, meals, property
types and neighbourhoods are ORed; facility selections and different categories
are ANDed. Rate conditions must match the same rate: the displayed lowest price
is always from the rates remaining after filtering.

Sort values are `recommended`, `price-asc`, `price-desc`, `rating`, and `stars`.
The default page size is 50 in mock mode (showing the full seeded catalogue) and
12 in live mode, with a maximum of 50. Response metadata includes
total matching hotels, pagination and facets. Facet counts deliberately describe
the unfiltered inventory for the selected destination, or all destinations when
none is selected, and are labelled that way in the UI.

Filter, sort and page choices round-trip through the URL. Discrete choices create
history entries; hotel-name and budget edits replace the current entry to avoid
one entry per keystroke. Filter/sort changes reset the page. A new stay clears
presentation filters, and changing currency clears budget bounds and pagination
without pretending to convert money. Browser back/forward and copied URLs restore
the controls. Filter chips remove individual selections; reset preserves the stay.

## Responsiveness and performance

Mock searches query the requested destination, or each persisted destination when
none is selected, and the requested currency using indexed relations. The backend
computes date/occupancy totals with each destination's seasonal rules, combines
the results, then applies filters, sorting and pagination once across the complete
set. It does not read the fixture file at runtime. This small
development catalogue is not a load test of a production supplier catalogue.

The frontend coalesces edits for 220 ms, cancels obsolete fetches, and caches query
results for 30 seconds. While same-stay filters change, existing cards remain in
place but are inert until fresh results arrive. Changing dates, destination,
currency or occupancy hides old prices immediately. Old query errors/retry buttons
are also hidden while the new query settles.

Live API inventory has a 30-second Redis cache keyed by supplier, markup policy,
destination, dates, occupancy, nationality and currency. Filters/sort/pagination
reuse that inventory. Concurrent identical requests coalesce in each API process.
Cached data is validated and original opaque rate IDs and their 15-minute expiry
are preserved; cache hits never extend the booking window. Failed supplier calls
or incomplete rate-reference writes are not published as successful inventory.

Local photographs use Next.js responsive image optimization, explicit dimensions
and lazy loading; only the first card is prioritized. Each gallery loads the
selected photo. The results page uses a desktop filter sidebar and a Radix mobile
dialog with keyboard focus management. Semantic colors support light/dark themes
and layouts retain RTL direction. Existing translations remain; new detailed
filter/preview labels currently have an explicitly marked English fallback.

Saved hotel IDs persist in local browser storage, with a visible visit-only
fallback if storage is unavailable. They are not account favourites or reservations.
The hotel details view strips list pagination/filters when requesting rooms for
the selected property, and displays cancellation terms and property-payable charges.

## Verification and remaining live requirements

Unit and HTTP-boundary tests cover filter combinations, same-rate budget matching,
sorting/pagination, date/occupancy pricing, mock mutation blocking, production-mode
rejection, cache expiry/reference reuse, URL round trips and stale-result UI states.
Database integration tests cover repeatable seeding, persisted catalogue reads
and database constraints using the dedicated `TEST_DATABASE_URL`. Run
`pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` before shipping;
apply test migrations and run `pnpm test:integration` for database changes.

The hotel results page follows the inspected Loveholidays desktop and mobile
reference: a compact blue masthead, white search strip, warm neutral results
background, individual rounded filter panels and photo-led cards. The company's
own logo and links remain. The results search has separate length-of-stay and
check-in controls; selecting a new check-in keeps the selected number of nights.
Submitting a changed stay clears result filters and starts from the first page.
The homepage retains its existing appearance and date-range search.

Browser verification covers the populated preview, filter URL updates, copied
URLs/reloads, Back/Forward restoration, sorting, pagination and the mobile filter
dialog. Sample API latency on one machine is not evidence of production capacity
or TBO response time. Before sales, finish localization of new English UI copy,
verify supplier account fixtures, and complete payment/booking certification
described in the TBO integration guide.
