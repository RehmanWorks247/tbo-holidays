# Repository working rules

Read README.md, docs/architecture.md, and docs/booking-flow.md before changing a domain.

1. Frontend business features live in `apps/web/src/features/<feature>`; route files in `app` compose them. Shared primitives belong in `components/ui`, cross-feature layout in `components/shared`.
2. Backend business domains live in `apps/api/src/modules/<domain>`. Follow existing `*.module.ts`, `*.controller.ts`, `*.service.ts` naming. Infrastructure belongs in `infrastructure`, durable workers in `jobs`.
3. Controllers handle transport, validation and delegation only. Business rules belong in services and explicit domain functions.
4. Never access Prisma from the frontend or share database records as public types.
5. Never expose raw TBO objects, credentials or supplier rate tokens to frontend code. Supplier implementations and wire DTOs stay inside `modules/tbo`.
6. Every authoritative price, tax, fee, markup, discount, availability decision and status comes from the backend. Use integer minor units with checked arithmetic and supported currencies. Never trust browser totals.
7. Payment and supplier integrations belong behind their existing provider interfaces. Webhooks require authentic verification before durable writes.
8. Prefer extending an existing module to creating a new directory. No microservices, CQRS, generic base services or repository wrappers without a concrete need.
9. Put code in shared packages only when actually used across applications/domains. Shared API schemas live in `packages/contracts`; derive types from Zod.
10. Use the simplest explicit abstraction that solves the current problem. Do not create empty folders or unused boilerplate.
11. Maintain strict TypeScript, no explicit `any`, runtime validation at external boundaries, consistent file/import naming and formatting.
12. Secrets and guest data must never appear in logs, source, browser bundles or error responses. Use validated env configuration, structured allowlisted log fields and generated request IDs.
13. Never silently swallow errors. Normalize external failures into domain errors. Distinguish definite failure from an unknown financial/supplier outcome.
14. Never duplicate a booking/payment mutation. Preserve database idempotency constraints, immutable price snapshots, quote ownership and atomic quote consumption. Never blindly replay supplier creation or refund calls.
15. Money received and pending work must be persisted together. Queue deliveries can repeat; workers must claim durable state before external effects. Unknown outcomes require reconciliation.
16. Protect object ownership and admin role checks in the API, irrespective of frontend route protection. Never add an authentication bypass for local convenience.
17. Read `apps/api/src/modules/tbo/INTEGRATION.md` before enabling supplier operations. Disabled adapters are explicit integration boundaries, not fake success paths.
18. After changes run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. For transactional changes also run integration tests against the dedicated test database. Never reset an ordinary application database to run tests.
19. Update relevant docs and `.env.example` when behavior/configuration changes. Keep lockfile changes intentional.
