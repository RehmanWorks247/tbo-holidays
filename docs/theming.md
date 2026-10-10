# Frontend design and theming

The web application uses local shadcn-style components built on Radix primitives,
Tailwind 4, and feature-owned CSS Modules. The travel homepage presents Stayline
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
| `--brand`, `--accent-yellow`                                             | Stable brand accents across both modes    |
| `--surface-subtle`, `--surface-blue`, `--surface-warm`                   | Secondary sections and panels             |
| `--text-secondary`, `--text-subtle`, `--muted-foreground`                | Supporting text                           |
| `--border`, `--input`, `--ring`, `--destructive`                         | Control outlines, focus, and errors       |
| `--search-button`, `--search-button-hover`, `--search-button-foreground` | Search action and its contrast pair       |
| `--image-overlay`, `--shadow-card`                                       | Image readability and card elevation      |

Use an existing semantic token when it describes the purpose. To add a new color,
define its light and dark values together, add an `@theme inline` mapping if a
Tailwind utility is needed, and check its foreground/background contrast in both
modes. The brand blue remains stable; primary actions can use a lighter blue in
dark mode with a contrasting foreground.

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

The visual design and Stayline branding do not imply membership, certification,
financial protection, customer-review ratings, or a relationship with another
travel business. Only display such claims after they are independently verified
for the operating business.

Search continues to use the supplier's city code. Destination inspiration does
not invent a city-code catalogue. Availability, prices, taxes, fees, quotes,
payments, and booking states remain authoritative API concerns. Existing disabled
supplier and payment adapters remain explicit integration boundaries. See
[architecture](architecture.md) and [booking flow](booking-flow.md).

Theme configuration needs no environment variables or backend changes.
