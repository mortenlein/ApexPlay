# ApexPlay Design System

ApexPlay is a CS2 / team-esport tournament control surface. The design language is a
**dark-first "broadcast control room"**: high-contrast, data-dense, calm under load. It should
feel like equipment you run a live event on — legible from across a LAN, unambiguous about
what's LIVE right now, and never flashy for its own sake.

> Source of truth: design **tokens** live as CSS custom properties in `src/app/globals.css`.
> `tailwind.config.ts` exposes them as semantic utilities. Reusable **components** live in
> `src/components/ui/`. Don't hardcode hex values in components — use the tokens.

---

## 1. Principles

- **Dark-first.** The primary surface is a warm near-black (`--mds-page`, an oklch charcoal). A
  light theme exists as a fallback but the product is designed for dim rooms and stage lighting.
- **Status is the loudest thing on screen.** LIVE (red, pulsing), Ready (green), Pending (amber),
  Done (muted). A glance should answer "what needs attention?" Use `StatusBadge`.
- **Data density over decoration.** 14px base, tables and cards over hero art. Whitespace
  organizes; it doesn't pad for its own sake.
- **One accent.** Brand blue (`--mds-action`) marks the primary action and the active state —
  nothing else competes for "this is the thing to click."
- **Calm motion.** Subtle hover lifts and the LIVE pulse only. No gratuitous animation.
- **Never promise what isn't there.** No button for a feature the data can't back. A spectator
  who clicks "Watch stream" and lands on a transparent OBS source has been lied to.

## 2. Color tokens

| Token (CSS var) | Tailwind | Role |
|---|---|---|
| `--mds-page` | `bg-page` | App background (near-black) |
| `--mds-card` / `--mds-card-hover` | `bg-card` / `bg-card-hover` | Surfaces |
| `--mds-input` | `bg-field` | Form fields |
| `--mds-border` / `--mds-border-hover` | `border-line` / `border-line-hover` | Borders |
| `--mds-action` / `--mds-action-hover` | `bg-brand` / `bg-brand-hover` | Primary action / active |
| `--mds-action-soft` | `bg-brand-soft` | Active nav / subtle brand fill |
| `--mds-green` | `text-success` | Ready / win / healthy |
| `--mds-red` | `text-danger` | LIVE / loss / error |
| `--mds-amber` | `text-warning` | Pending / warning |
| `--mds-text-primary` | `text-fg` | Primary text |
| `--mds-text-muted` | `text-fg-muted` | Secondary text |
| `--mds-text-subtle` | `text-fg-subtle` | Tertiary / metadata |

## 3. Typography

The UI is **monospace throughout** (the Subtick identity):

- **Body / UI / data:** JetBrains Mono (`--font-jet`, Tailwind `font-sans` and `font-mono`),
  14px base, line-height 1.55.
- **Display / headings:** Martian Mono (`--font-martian`, Tailwind `font-brand`), 700, tight
  tracking.

### The contract: shout on labels, never on content

Because the type is monospace, case costs nothing but **letter-spacing costs width** — and every
px of tracking on a team name is a px that becomes an ellipsis. So:

| Kind | Class | Style |
|---|---|---|
| **Label** — section markers, field labels, eyebrows, metadata | `.mds-uppercase-label` | uppercase, 0.1em tracking, 11px, muted |
| **Content** — team, player and tournament names | `.mds-name` / `.mds-name-lg` | the user's own casing, **no tracking**, wraps |
| **Numeric** — scores, seeds, seat labels, clocks | `.mds-numeric` | tabular figures, never wraps |

**Never put `uppercase tracking-*` on a value a human typed.** `KRISTIANSAND KIN…` is a bug, not
a style.

### Names must survive

A name a marshal can't read is worse than a name that takes two lines. Let names **wrap**
(`.mds-name` sets `overflow-wrap: anywhere`); where a rail genuinely cannot grow, use
`.mds-clamp-2` (two lines) rather than `truncate` (one line + ellipsis). Reserve `truncate` for
places where the full value is also shown elsewhere on screen. Never set a fixed `max-w-[…px]`
on a name: give the column room instead.

Headings: h1 2.5rem, h2 1.75rem, h3 1.25rem, all weight 700 with `-0.02em` tracking.

## 4. Components (`src/components/ui/`)

| Component | Use |
|---|---|
| `Button` | `primary` (brand), `secondary`, `ghost`, `danger`; sizes `sm`/`md`. |
| `Card` | Surface container; `interactive` for clickable cards (hover lift). |
| `Badge` / `StatusBadge` | Tones: live/ready/pending/done/danger/info. `StatusBadge` maps a match status string to a tone+label automatically. |
| `Input` | Labelled field with optional hint. |
| `EmptyState` | Zero states for lists/tables. |
| `PageHeader` | Eyebrow + title + subtitle + right-aligned actions. |
| `TopNav` | The single persistent, role-aware app header. |

Underlying utility classes (`.mds-card`, `.mds-btn-primary`, `.mds-input`, `.mds-table`,
`.mds-badge`, `.mds-empty-state`, `.workspace-*`) live in `globals.css`. Prefer the React
components; reach for the raw classes only for one-offs.

## 5. Layout

- Content max width `--mds-max-content` (1400px) via `.mds-container` / `max-w-content`.
- Radius scale: `rounded-sm` (4px) for controls, `rounded` (8px) for cards, `rounded-lg` (12px)
  for large panels.
- Shadows are quiet — `shadow-sm` on resting surfaces, a soft lift on hover only.

## 6. Surfaces (information architecture)

The app is organized into three role-based surfaces:

- **Public / Spectator** — brackets, schedule, live scores, rosters, OBS overlay. No login.
- **Player** — Steam login: register, team invite link, your queue position, notifications.
- **Control** — admin (`/admin`) + marshal (`/marshal/dashboard`): tournaments, brackets, match
  flow, floor tools. What each surface actually does day-to-day: `docs/LAN-RUNBOOK.md`.

## 7. Do / Don't

**Do** use tokens (`bg-card`, not `bg-[#151719]`); use `StatusBadge` for any match/tournament
state; keep one brand accent per view; design for a dim room.

**Don't** introduce new accent colors; don't style status ad-hoc; don't add motion beyond hover
+ the LIVE pulse; don't hardcode hex values; don't reintroduce the old multi-product token set;
don't uppercase or letter-space a name; don't render a raw enum (`SINGLE_ELIMINATION`) or an id
fragment to a user; don't ship a control for data that doesn't exist.
