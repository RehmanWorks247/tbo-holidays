# Real hotel catalogue and suggestions

The backend reads TBO's authenticated `CountryList`, `CityList`,
`TBOHotelCodeList` and `HotelDetails` endpoints. No fictional fallback enters the
live hotel flow. The explicit preview remains separate.

## Activate and verify the staging account

The assigned URL and credentials belong only in the ignored root `.env`.
`TBO_READS_ENABLED` remains false until account verification succeeds. From a
machine that can reach PostgreSQL, Redis and the assigned HTTPS supplier endpoint:

```sh
pnpm db:generate
pnpm db:deploy
pnpm --filter @hotel/api tbo:verify
```

The verification command makes only country/city/catalogue/detail/availability/
PreBook reads. It validates runtime schemas and identities and prints sanitized
counts, returned currencies and status; it never stores credentials or rate tokens
in fixtures. `TBO_VERIFY_COUNTRY` and `TBO_VERIFY_CITY` can override the sample
AE/Dubai. It does not change `.env`. Confirm the observed profile currency and
pricing interpretation before enabling `TBO_READS_ENABLED=true`, then synchronize
the catalogue using the commands below and start the app with `pnpm dev`.

On Windows, the launcher can verify and enable reads for one application launch:

```powershell
.\Start-HotelApp.ps1 -EnableTboReads
```

Stop the existing API and frontend, then run this in a normal,
non-Administrator PowerShell. Next.js permits one development process per checkout,
even when ports differ. Verification must pass before catalogue synchronization
and startup with reads enabled. This flag leaves `.env` unchanged and does not
enable bookings or payments. Open [the hotel catalogue](http://localhost:3001/hotels)
after the launcher reports readiness. Use `-VerifyIntegrations` additionally to
apply dedicated test migrations and run integration tests.

On 28 October 2026 this workspace's supplier verification was blocked by DNS
(`ENOTFOUND`), and local database connections were denied by the execution
environment. No real inventory, account currency or end-to-end latency was
verified. Booking and payment integrations retain their existing disabled state.
The 29 October 2026 retry again failed at CountryList with
`SUPPLIER_UNAVAILABLE`; a direct DNS lookup confirmed `ENOTFOUND` for
`api.tbotechnology.in`. The current ignored `.env` retains
`TBO_READS_ENABLED=false`. No real account payload or end-to-end search was
verified from this runner.

The 29 October search changes passed lint, all application TypeScript checks and
the backend build using the existing generated Prisma client. The frontend suite
passed 245 tests; the focused catalogue, supplier and search suite passed 109.
The full backend suite's 30 HTTP boundary tests could not connect to their local
test servers (`EACCES`); dedicated test migrations could not reach PostgreSQL
(`P1001`). The standard build could not replace the engine DLL held by the running
API, and the separate webpack build was denied a write under `.next` (`EPERM`).
These environment failures are not successful integration or build verification.
The launcher reuses a generated Prisma client only after its full schema and
package version match, avoiding unnecessary engine replacement during a restart.

## Persistence, refresh and search

PostgreSQL stores `TboCountry`, `TboDestination` and `TboHotel` static content.
The hotel JSON contains only validated, normalized application `Hotel` fields,
never raw supplier objects, rate tokens, prices or availability. Composite keys
include a SHA-256 scope derived from the assigned endpoint and account username;
staging and production accounts cannot reuse each other's catalogue or suggestion
cache. A complete, validated country/city refresh commits atomically. Missing
records become inactive only inside that successful replacement transaction.

Apply the checked-in migration with `pnpm db:deploy`. It enables PostgreSQL's
`pg_trgm` extension and adds GIN substring indexes plus B-tree prefix indexes.
The database migration role needs permission to install that trusted extension.
Two-character suggestions use prefix search; longer queries use accent-normalized,
case-insensitive substring search. `%`, `_` and backslashes are literal input.

With verified reads enabled, startup and a periodic timer synchronize city lists
for `TBO_CATALOG_COUNTRIES` (default `SA,AE,GB,TR,ID,PK`). The country directory
retains names supplied by CountryList; cities in other countries load when that
country is searched. These settings control startup prewarming, rather than an
invented list of supported countries. Startup does not wait for the supplier.
Background failures log only an allowlisted code and existing
content remains usable. `TBO_CATALOG_TTL_SECONDS` defaults to one day. No supplier
calls occur when typing into the search box.

`GET /api/v1/hotels/suggestions?query=Dubai&limit=10` returns normalized country,
city and hotel recommendations. Country selections use `type: 'country'` and
`destinationId: 'country:TR'`, for example. The limit is capped at 12; queries shorter than two
characters return an empty list. Exact numeric identifiers support restoring a
shared search URL. Results are cached in Redis for five minutes; empty results
are not cached while the initial import is running. Cache outages fall back to
indexed database queries and emit safe diagnostics. The legacy destinations
endpoint returns at most 100 cities; typeahead searches all synchronized cities.
Typing a country or city name and submitting directly also works; choosing a
suggestion is optional. Backend matching normalizes capitalization, accents and
whitespace. Turkey and Türkiye are explicit aliases for TR. Ambiguous city or
hotel names require a more specific suggestion rather than an arbitrary property.
Disabled supplier reads produce a configuration error instead of an unexplained
empty dropdown.

## Browse real hotels before choosing dates

`GET /api/v1/hotels/catalog?query=Turkey&page=1&pageSize=20` accepts an optional
query (up to 100 characters), page and page size. The page size is capped at 50.
Queries can be country names/codes, canonical country selections, city names/IDs
or indexed hotel names/IDs. The normalized response contains `source: 'live'`,
`hotels`, `total`, `page`, `pageSize`, `totalPages` and `syncing`. It contains
static hotel content only: no prices, rate references or availability assertions.
Pagination accepts up to 1,000,000 pages so large worldwide catalogues are not
limited to the previous 10,000-page search bound. Each response still contains
at most 50 hotels.

The live `/hotels` screen uses this endpoint when stay criteria are absent.
An empty browse imports the complete supplier catalogue across all countries and
cities. Configured startup markets and warm city IDs never restrict this result.
The worldwide import is shared across unfiltered requests and pages; country
directories load sequentially and city content uses at most three concurrent reads.
Fresh country names are reused while additional city directories load, avoiding
a repeated CountryList request for each country. A country browse warms all its
cities with the same concurrency limit. Static hotels appear progressively; `total` and pagination can
grow while `syncing` is true. The frontend polls only while that work is pending.
Failed background reads become safe domain errors on subsequent requests, rather
than an endless loading state. Fresh city content is reused until its TTL expires.

Submitting a hotel name or a city name not yet present in the directory also
starts or joins that worldwide import. Results stay marked as syncing until
discovery completes, and import failures remain visible; a partial catalogue
does not establish that the name has no matches. Known cities, countries and
explicit identifiers keep their scoped imports.

Complete dates, nationality, occupancy and currency remain required for priced
`GET /api/v1/hotels/search`. That search resolves names in the backend, loads all
the selected country's active cities and requests availability in batches of 100
hotel codes. Catalogue resolution and availability share the configured deadline.
A timeout or failed city/batch rejects the priced search; it never labels a subset
as complete country inventory. Broader countries can need catalogue prewarming or
a more specific city search to finish within that deadline. Inventory cache keys
normalize destination capitalization and accents; country searches retain a
country label rather than the first returned hotel's city.

## Hotel content refresh and maintenance

On 29 October 2026, manual browser E2E checks confirmed that the default
currency/guest URL opens **All hotels**, submitting `tUrKeY` without dates opens
country browsing, and clearing the location restores **All hotels**. Live hotel
retrieval failed: the existing backend returned `INVALID_HOTEL_ID` for
`/api/v1/hotels/catalog`, treating the new catalogue route as a hotel identifier.
That process needs to restart with the rebuilt API. Live pagination could not be
verified without returned hotels. The 248 frontend tests, 91 catalogue/supplier
tests, contract tests and backend build passed; full application commands remain
blocked by the running API's Prisma DLL lock. Browser evidence is recorded in
`test-results/unfiltered-hotels-e2e.jpg`. These are partial E2E results, not a
successful live supplier check.

A further autonomous attempt on 29 October rebuilt the API and reran
`tbo:verify`; it failed at `CountryList` with `SUPPLIER_UNAVAILABLE`. A direct
diagnostic reported supplier DNS `ENOTFOUND` and localhost socket `EACCES`.
The browser independently confirmed that the running API still returns
`INVALID_HOTEL_ID` for the catalogue route. The execution environment also
rejected the request for an unsandboxed connectivity check, so that process
could not be replaced and live E2E remains blocked. This is an execution-access
restriction, not evidence of invalid TBO credentials or a Docker failure.
Native PostgreSQL 17 is already installed in this checkout; the launcher uses
Docker only for a missing dependency such as Redis. No native Redis executable
was found in the inspected installed locations. Replacing Redis with a mock
would not establish a valid live test.

Hotel names become discoverable after the city's static hotel list has been
synchronized. A destination search loads its city catalogue once and reuses it
until expiry. Prewarm important markets before launch rather than waiting for the
first search. Only known, active supplier destinations can be warmed; no city
codes are guessed. Details are persisted for known hotels with the same TTL.
Set `TBO_CATALOG_WARM_CITIES` to comma-separated supplier city IDs for background
startup/periodic hotel imports; its default is empty because IDs must come from
the assigned account. Hotel-name suggestions cover these and previously searched
cities. Broader prewarming uses the maintenance command below.
Transient city-catalogue outages may use the last successful static content;
fresh availability and prices must still come from the supplier read flow.

After `pnpm build`, run the authenticated read-only maintenance command:

```sh
pnpm --filter @hotel/api catalog:sync
pnpm --filter @hotel/api catalog:sync --countries=SA,AE --cities=SUPPLIER_CITY_CODE
pnpm --filter @hotel/api catalog:sync --countries=SA --all-cities --max-cities=100
```

Replace `SUPPLIER_CITY_CODE` with an ID returned by destination suggestions. The
last command warms at most 100 cities, oldest/unpopulated first; repeated runs
advance through the market without fetching every city in one unbounded job.
Use `--force` to refresh fresh content too. The CLI processes cities sequentially,
uses parameterized bulk database writes and prints only aggregate counts/errors.
It does not enable reads or supplier booking/payment operations. Schedule this
command with the deployment's existing job runner when broad hotel-name coverage
is needed; the periodic application refresh discovers countries/cities and warms
only explicitly configured city IDs.

Selecting a hotel recommendation sends its `hotelId` alongside its destination.
The backend confirms that the hotel belongs to that city and searches that exact
property. Availability caches include the complete stay, occupancy, nationality,
currency and hotel selection. Catalogue data never authorizes a booking or a price.

Catalogue transaction tests run only on the dedicated `TEST_DATABASE_URL`, with
unique account scopes and scoped cleanup. Unit tests and synthetic fixtures prove
mapping and failure behavior; they do not certify actual account access or prices.

## Repeatable live browser acceptance

With the updated frontend and API running, use:

```sh
pnpm test:e2e --preflight-only
pnpm test:e2e
```

The preflight verifies the public catalogue route, live data mode and frontend
reachability. It reports a stale API route, disabled supplier reads or denied
network access before trying to launch a browser. The full runner checks real
unfiltered hotels, mixed-case country/city/hotel-name searches, clearing the
location, pagination and a hotel detail page. It uses hotels returned by the
API; it neither mocks inventory nor performs bookings or payments. It waits for
sample results, not completion of the worldwide import.

The browser runner requires an installed `puppeteer` or `puppeteer-core` module.
To reuse an existing installation, set `E2E_BROWSER_MODULE` to its absolute module
entry point and `E2E_BROWSER_EXECUTABLE` to an installed Chrome or Chromium
executable. The runner never installs or downloads dependencies. No browser
dependency is required for `--preflight-only`.

Optional settings are `E2E_WEB_URL` (default `http://localhost:3001`),
`E2E_API_URL` (default `http://localhost:4001/api/v1/`), `E2E_COUNTRY` (Turkey),
`E2E_TIMEOUT_MS` (90,000; allowed 10,000–300,000), and `E2E_OUTPUT_DIR`.
Each run saves an allowlisted `report.json` and, for completed browser cases,
screenshots beneath `test-results/hotel-live-e2e-*` by default. Failures exit
nonzero; a successful preflight alone is not a browser acceptance pass.

On 29 October 2026 both the preflight and full runner stopped with
`API_UNREACHABLE` (`EACCES`). Reports are in
`test-results/e2e-validation/live-preflight/report.json` and
`test-results/e2e-validation/live-browser/report.json`. Browser checks could
not run from that terminal. The separate in-app browser retry is recorded in
`test-results/live-hotels-retry-e2e.jpg`.

## Verification in this workspace (28 October 2026)

- Root lint and typecheck passed, including Prisma generation.
- The full unit/HTTP test command passed 496 tests; 30 HTTP tests could not connect
  to their local test servers (`EACCES`). The final 42 catalogue/schema tests also
  passed after additional ranking/concurrency regression coverage.
- The API production build passed. The web Turbopack build did not complete;
  the webpack fallback was blocked by filesystem `EPERM` while creating output.
- Dedicated test database migration failed with `P1001`; all three integration
  suites failed at connection setup (25 tests skipped). No ordinary database was
  reset or used as a test database.
- The staging verification command failed at CountryList with normalized
  `SUPPLIER_UNAVAILABLE`; the direct connectivity check identified DNS `ENOTFOUND`.
  Real-account data and end-to-end performance remain unverified.

The checkout initially pinned pnpm 12.14.0 despite its documented pnpm 11 engine
range. The package-manager pin is now aligned to pnpm 11.9.0; application
dependency versions and lockfile entries are unchanged. The earlier checks used
the installed pnpm 11.9.0 through a temporary launcher.

`Start-HotelApp.ps1` provides a user-run Windows setup path when this agent's
execution sandbox cannot access local services. It validates local endpoints,
starts dependencies, builds the API and applies application migrations. The
`-VerifyIntegrations` option also applies dedicated test migrations and runs
integration and supplier checks. `-EnableTboReads` explicitly requests supplier
verification and, on success, catalogue synchronization and reads for the launched
processes. Without that option the configured gate is preserved. Schema checks
alone do not certify pricing semantics; `.env`, booking and payment gates remain
unchanged. The launcher makes no elevation or security-policy changes.
Its PowerShell syntax was checked; full execution still requires a user terminal
with PostgreSQL, Redis and supplier connectivity.
Use a normal, non-Administrator PowerShell: PostgreSQL rejects elevated execution.
Both the launcher and workspace PostgreSQL helper check this before invoking
PostgreSQL. A failed configuration read is reported separately from a configuration
mismatch. The launcher records stage names and completion/failure markers in
`test-results/local-run-*/setup-status.log`, without recording credentials or raw
command output.
The Docker readiness probe checks its exit code on Windows PowerShell 5.1 as well
as newer PowerShell versions, allowing an offline daemon to reach the startup step.
