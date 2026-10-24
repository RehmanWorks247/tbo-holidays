# Hotel booking UI preview

Open `/preview/hotels` to explore the frontend-only booking journey. The home
page uses the same `PreviewSearchForm` as the demo results page, including its
destination, nights, date and guest controls. Homepage searches go to
`/preview/hotels` with the selected stay. The existing hotel search also includes
a link to the demo. Run the web app with
`pnpm --filter @hotel/web dev`; the preview does not need the API, PostgreSQL,
Redis, supplier credentials or a signed-in user.

The preview includes searchable destination and hotel suggestions, per-room
adult/child controls, stay dates, local result filters, a hotel room-selection
screen, and an extras → passengers → payment walkthrough. Unknown hotel or room
IDs return the normal not-found page. The live hotel and protected checkout
routes keep their existing behavior and authorization.

## Component boundaries

- `features/hotel-search/data/preview-hotels.ts` owns typed presentation fixtures,
  bounded URL parsing and demo navigation. It does not import supplier data or
  database records. Selection IDs are never sent to booking endpoints.
- Search controls and results live in `features/hotel-search/components/preview-*`.
- Hotel summary, gallery and room options live in
  `features/hotel-details/components/preview-*`.
- Extras, passengers, payment display and summary live in
  `features/checkout/components/preview-*`.
- `app/(public)/preview` composes these features. `components/shared/preview-shell`
  owns the shared preview notice and navigation.

Only stay and hotel/room selections appear in URLs. Passenger fields remain in
component memory and are discarded on refresh/navigation; they are never logged,
sent to a server or saved to browser storage. Payment uses static placeholder
information, and the payment action is disabled. The preview never reports a
successful payment or confirmed booking.

## Data and performance

All amounts are integer GBP minor units representing illustrative display prices.
They are fixed fixtures, not quotes or availability. Selecting different dates
or occupancy changes the UI, not supplier availability or authoritative pricing.
The preview is explicitly English/GBP regardless of global language or currency
preferences. Reviews, temperatures, location illustrations and hotel photography
are samples; photos use the existing locally stored assets.

The implementation reuses installed React/Next.js and Radix primitives, CSS
Modules and local optimized images. There is no extra map SDK, external font,
image service, data request, dependency or environment setting. Separate routes
keep checkout out of the search page's initial module graph. Images use bounded
responsive sizes and are lazy loaded except for the main visible hotel image.

When connecting real data, keep the presentational components and replace fixture
inputs with validated public API response models. Route live room selection
through authenticated rate recheck, owned quotes, guest validation and the
existing idempotent booking/payment services. Backend prices and statuses remain
authoritative. The public demo route is not a shortcut around that workflow.

Preview pages are marked `noindex, nofollow` and are not a sales flow.
