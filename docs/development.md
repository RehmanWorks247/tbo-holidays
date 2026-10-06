# Development

## First run and daily work

Follow the root README for Node 24, pnpm 11.9, environment files and Docker setup. `pnpm install` uses the lockfile; native lifecycle scripts are explicitly allowlisted in `pnpm-workspace.yaml`. Optional msgpackr native acceleration is disabled. Keep this policy explicit when dependencies change.

The checked-in initial migration creates indexes, unique idempotency constraints, monetary integrity constraints and domain records. Use `pnpm db:deploy` for first setup and CI. After editing the schema, use `pnpm db:migrate`, review the generated SQL, and commit both schema and migration. Never use a development migration reset against shared data.

Turbo builds shared contracts before dependent checks. When changing a shared schema during a long-running dev session, run `pnpm --filter @hotel/contracts build` again so both applications consume the same compiled contract. API development uses Nest's watch mode; frontend uses Next's dev server.

## Working in the codebase

- Add UI feature code under `apps/web/src/features/<feature>`. Keep routes small. HTTP calls belong in `services/api`; query and mutation hooks stay with their feature. Protected query caches are scoped to the signed-in user and recreated when that identity changes.
- Add API domain rules to an existing service/module. Controllers validate and delegate. Most services use Prisma directly; introduce a repository only when it offers a concrete domain benefit.
- Change Zod contracts first when changing transport shapes. Browser/database/supplier representations are intentionally separate. Validate external responses before mapping them.
- Use safe integer minor units. Shared supported currencies are USD, EUR, GBP, AED, PKR and INR. CurrencyService rejects unsupported precision rather than silently rounding unknown currencies. Do not add FX conversion without an explicit source and persisted conversion snapshot.
- Money and provider mutations need stable identifiers. An HTTP retry must reuse the original idempotency key. Supplier creation is never an automatically retried network request.

## API conventions

All endpoints use `/api/v1`. Successful JSON responses are `{ data, requestId }`; errors are `{ code, message, details?, requestId }`. A server-generated `X-Request-Id` also appears on the response. Request bodies use strict Zod contracts, so unexpected authoritative values such as a browser-supplied price are rejected.

| Route                                   | Access / behavior                                                       |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `GET /health/live`, `GET /health/ready` | Public liveness / PostgreSQL and Redis readiness                        |
| `GET /hotels/search`                    | Public; city code, ISO dates, nationality, currency, JSON-encoded rooms |
| `GET /hotels/:id`                       | Public normalized hotel details                                         |
| `POST /hotels/recheck`                  | Session; opaque rate ID becomes a user-bound quote                      |
| `POST /bookings`                        | Session; quote ID and UUID idempotency key                              |
| `GET /bookings`, `GET /bookings/:id`    | Session and object ownership                                            |
| `PATCH /bookings/:id/guests`            | Session; occupancy matched to stored rooms; locks at checkout           |
| `POST /bookings/:id/cancel`             | Session; explicit integration-required response for now                 |
| `POST /payments/checkout`               | Session; booking ID and UUID idempotency key; disabled gateway for now  |
| `POST /payments/webhooks/:provider`     | Provider signature boundary, original raw request bytes                 |
| `GET /users/me`, `PATCH /users/me`      | Session and internal customer profile                                   |
| `GET /admin/bookings`                   | Internal ADMIN role                                                     |

The API applies request throttling per process. Configure trusted reverse proxies deliberately before using client-IP headers; the scaffold does not trust arbitrary forwarded headers. For multiple API replicas, replace the default throttler storage with shared storage or enforce distributed limits at the gateway.

## Configuration and secrets

Root `.env` is read by Nest and database commands. Web `.env.local` is read by Next. Never prefix a secret with `NEXT_PUBLIC_`. Public variables are baked into the web bundle, so changing them requires rebuilding.

Production API startup requires authentication verification configuration and HTTPS frontend origins. The web permits credential-free builds so a scaffold can be checked in CI; malformed keys fail validation, and an incomplete authentication pair displays a setup state. Set both web keys before building a deployment that should enable sign-in. No authentication bypass exists. Missing credentials are setup states, never synthetic user sessions.

The logger allows only safe request metadata and drops query strings, body contents, cookies, tokens and raw exception messages. Financial/supplier services log identifiers and normalized codes. Do not add PII to log context. Audit records and guest/contact snapshots contain personal data: define retention, access controls and deletion/export procedures before launch.

## Testing

Unit tests cover price math, date and payload validation, booking states, guest occupancy, supplier DTO conversion, safe retries and webhook signature rejection. Frontend tests cover centralized API behavior, date validation, filters and environment configuration. `pnpm test` needs no supplier credentials or database.

The PostgreSQL suite checks concurrent intent deduplication, cross-user isolation, webhook deduplication and ordering, amount mismatch, transaction rollback, and ambiguous supplier outcomes. Use only a dedicated test database and apply migrations with `pnpm --filter @hotel/api db:test:deploy`. CI provisions PostgreSQL/Redis and runs both unit and integration suites plus lint, types and builds.

Production builds do not prove a TBO contract or gateway is certified. Live sandbox contract tests, Clerk sign-in and webhook tests, email delivery, refund/cancellation policy handling, migrations on realistic data, observability and deployment checks are required when completing those integrations.

## Local troubleshooting

- Database connection failure: check Docker's daemon, `pnpm infra:up`, ports, and the root environment file. Next's public pages can render independently; Nest intentionally waits for its infrastructure.
- Shared type export missing: rebuild `@hotel/contracts`, then restart a stale dev process.
- Prisma type missing: run `pnpm db:generate` after installation or schema changes.
- Search returns `SUPPLIER_NOT_CONFIGURED`: read the TBO module notes and validate your assigned API contract before enabling reads.
- Protected page explains missing Clerk setup: configure both web keys and backend verification, then restart/rebuild as appropriate.
- Outbox events stop retrying: inspect their `lastError` and attempts. Resolve the provider/configuration issue before deliberately resetting delivery eligibility. Never replay a booking creation to resolve uncertainty.

`pnpm infra:down` preserves database and Redis volumes. Back up data before choosing to remove any volumes.
