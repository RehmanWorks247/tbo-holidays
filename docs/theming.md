# Frontend design and theming

The web application uses local shadcn-style components built on Radix primitives,
Tailwind 4, and feature-owned CSS Modules. The travel homepage presents Best Holiday Packages
branding, destination photography, and the existing hotel-search flow. Route
files compose features; presentation does not move booking rules into the browser.

## Component ownership

Reusable primitives live in `apps/web/src/components/ui`. Dialog, popover, and
dropdown-menu wrappers use Radix for focus management, keyboard navigation,
escape dismissal, and portal positioning. Keep those behaviors when customizing
their appearance. Form controls must retain labels, focus indicators, and error
messages; dialogs require a title and appropriate description.

The shadcn configuration in `apps/web/components.json` points to the existing UI
directory, `@/lib/cn` class-merging helper, and global stylesheet. Extend these
primitives before introducing a second component library. The wrappers accept
conventional Radix props and a `className` for local styling.

Header, footer, and appearance controls live in `components/shared`. Homepage,
search-form, and date-picker layouts live in the hotel-search feature alongside
their CSS Modules. Use modules for layout and component-specific selectors; use
global tokens for shared colors. Avoid feature styles that globally target all
buttons, dialogs, or inputs.

## Theme behavior

`components/shared/theme-provider.tsx` wraps the application with `next-themes`.
The default is **System**. The appearance menu offers **Light**, **Dark**, and
**System**, and persists the selected preference in browser storage. System mode
follows the operating-system preference. This preference belongs to the browser,
not the signed-in account.

The provider applies a class to the document root. The root layout uses
`suppressHydrationWarning` for that theme attribute; the selector waits until
hydration before reading the active theme. Transitions are disabled during theme
changes, and global styles honor reduced-motion preferences.

## Customizing colors

Set `--font-family` in the same global stylesheet to change typography across the
page and controls. The default system font stack needs no remote font service.

Edit `apps/web/src/styles/globals.css`. The `:root` block defines the light palette
and `.dark` defines the dark palette. Tailwind's `@theme inline` mappings expose
these values to utilities such as `bg-background`, `text-foreground`, and
`border-border`. CSS Modules use the same values through `var(--token-name)`.

| Tokens                                                                   | Purpose                                   |
| ------------------------------------------------------------------------ | ----------------------------------------- |
| `--background`, `--foreground`, `--card`                                 | Page and card surfaces with readable text |
| `--primary`, `--primary-foreground`, `--text-link`                       | Theme-aware actions and links             |
| `--brand`, `--accent-brand`                                              | Charcoal brand panels and blue accents    |
| `--surface-subtle`, `--surface-accent`, `--surface-warm`                 | Secondary sections and panels             |
| `--text-secondary`, `--text-subtle`, `--muted-foreground`                | Supporting text                           |
| `--border`, `--input`, `--ring`, `--destructive`                         | Control outlines, focus, and errors       |
| `--search-button`, `--search-button-hover`, `--search-button-foreground` | Search action and its contrast pair       |
| `--image-overlay`, `--shadow-card`                                       | Image readability and card elevation      |

Use an existing semantic token when it describes the purpose. To add a new color,
define its light and dark values together, add an `@theme inline` mapping if a
Tailwind utility is needed, and check its foreground/background contrast in both
modes. The brand accent is exactly `#00A7E1` in both themes, paired with charcoal
panels and blue-tinted secondary surfaces. Blue actions use white foregrounds,
while text links use a darker blue in light mode and a lighter blue in dark mode
to maintain contrast. The shared `components/shared/site-logo.tsx` renders the
supplied transparent `public/images/best-holiday-packages-logo.png` in both the
header and footer. The original artwork is used in both themes without a backing
box, border, recoloring, or cropping. Responsive sizing preserves its 1044 × 653
aspect ratio, with a 180-pixel desktop width and a 128-pixel mobile width. Next.js
optimizes image delivery for the displayed size. Page metadata and accessible
navigation labels use the company name, Best Holiday Packages.

Popover, dropdown, and dialog content renders in a portal under the document
body. Style it with global semantic tokens so it inherits the active theme even
outside its feature container. Do not depend on a parent card selector to set a
portal's background or text. Check menus, the calendar, dialogs, focus states,
and disabled controls in both themes as well as mobile layouts.

## Editorial content and integration boundaries

Destination cards and photographs provide inspiration; they are not supplier
inventory, hotel listings, availability, or price claims. Photography is served
locally from `apps/web/public/images`; see [image sources](image-sources.md).
Hearts keep saved inspiration in a feature provider above the routes. Internal
navigation preserves the selection, including trips to the hotel search and back.
The selection stays in memory only: a full page reload clears it, and it is not
persisted to browser storage or an account.

The visual design and Best Holiday Packages branding do not imply membership, certification,
financial protection, customer-review ratings, or a relationship with another
travel business. Only display such claims after they are independently verified
for the operating business.

Search continues to use the supplier's city code. Destination inspiration does
not invent a city-code catalogue. Availability, prices, taxes, fees, quotes,
payments, and booking states remain authoritative API concerns. Existing disabled
supplier and payment adapters remain explicit integration boundaries. See
[architecture](architecture.md) and [booking flow](booking-flow.md).

Theme configuration needs no environment variables or backend changes.

## Currency and language selectors

The shared header includes a currency code and circular language flag, opening
wide, responsive Radix dialogs with suggested choices, full lists and selected
checkmarks. Escape, outside click and the close button dismiss them; focus returns
to the trigger. On phones the dialogs fill the viewport and scroll. The controls
remain visible below the account actions in the mobile header.

`SitePreferencesProvider` stores validated currency and locale choices in browser
storage under `tbo-site-preferences` and synchronizes them across tabs. Defaults
are USD and English (US). If storage is unavailable, choices still work for the
visit and the selector reports the persistence problem. The public `tbo-locale`
cookie (one year, SameSite=Lax, Secure on HTTPS) also supplies the locale to server
rendering, avoiding an English first render on subsequent visits. Invalid cookie
values fall back to English. It contains only a validated locale, never user data.

The currency choices are the API's supported USD, EUR, GBP, AED, PKR and INR.
New searches use the saved preference. A valid search URL takes precedence when
opening an existing search; changing currency updates only its currency parameter
and requests new backend prices without clearing form drafts. The guest panel
displays the search currency; the header owns its selection. Existing quotes and
bookings keep their original price and currency. There is no browser conversion
or expansion of the backend currency contract.

The language menu matches the 45 choices, native names and ordering in the
Booking.com reference inspected on 15 October 2026. The catalogue in
`lib/site-locales.ts` owns supported locales and local flag assets. Typed message
dictionaries cover header/footer navigation, appearance controls, selector dialogs,
search controls, homepage editorial sections and destination details, hotel results,
account/admin screens, checkout, bookings, validation, error and loading screens.
`lib/page-english.ts` combines feature-owned source catalogues; `lib/page-messages.ts`
assembles exhaustive translations for all 45 locale choices. Interpolated strings
stay plain text. `usePageMessages` applies the current preference without remounting
forms or replaying API mutations. Filters, saved destination IDs, guest entries,
query identity, quote currency and idempotency keys do not depend on the locale.

The document language/direction, page title and description update with the
selection. Arabic and Hebrew use right-to-left layouts, logical spacing and
mirrored directional artwork. Stay dates remain Gregorian and are formatted in
UTC to preserve their calendar day. Quote expiry timestamps use the user's time
zone. Localized money formatting only changes presentation of the API's amount
and currency; it does not convert a quote.
The six supported currencies use the API's two minor-unit decimal places,
explicitly overriding locale-specific cash rounding (for example PKR).

Public API error codes map to translated messages. Unknown outcomes tell travellers
to check booking/payment status before retrying; a translation cannot imply that
a payment failed or a hotel confirmed it. Raw provider errors are not displayed.
Guest names, references, supplier hotel/room names, descriptions, facilities and
policies remain original data. No content or personal data is sent to a translation
service. The hotel details screen identifies supplier content in its original language.

Clerk's own screens load `@clerk/localizations` on demand without remounting the
authentication or query providers. Its catalogue currently has no Estonian,
Latvian, Lithuanian, Slovenian or Filipino translation, so that external widget
uses Clerk's English fallback for those choices. Argentine Spanish uses the
available Rioplatense Spanish translation; Serbian follows Clerk's supplied
Serbian script. Other missing provider strings can also fall back to English.
Hosted authentication/payment pages are controlled by their providers. All
TBO-owned account and booking pages have complete translations independently.
See [Clerk localization](https://clerk.com/docs/guides/customizing-clerk/localization).

Flags identify the language/region and never set the guest nationality. No
authentication, supplier or payment settings change. Catalogue tests check every
leaf and interpolation variable; rendering tests cover checkout and booking
details in every locale using synthetic data, without accessing a real account.
