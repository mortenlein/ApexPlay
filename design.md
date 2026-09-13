# Summit Design System

Summit is a CS2 / team-esport tournament control surface. The design language is a
**dark-first "broadcast control room"**: high-contrast, data-dense, calm under load. It should
feel like equipment you run a live event on — legible from across a LAN, unambiguous about
what's LIVE right now, and never flashy for its own sake.

> Source of truth: design **tokens** live as CSS custom properties in `src/app/globals.css`.
> `tailwind.config.ts` exposes every one of them as a semantic utility. Reusable **components**
> live in `src/components/ui/`.
>
> **The rule: never write `var(--mds-*)` or a raw hex inside a component.** Use the utility
> (`bg-card`, `text-fg-muted`, `border-line`, `text-label`). A token written inline in JSX is
> invisible to a token change and has to be hunted by hand — see §2.4 for the migration table.

---

## 1. Principles

- **Dark-first, but light is real.** The primary surface is a warm near-black. The light theme
  is a complete token set, not a stub — the toggle in the header is a supported switch (§2.3).
- **Status is the loudest thing on screen.** LIVE is a *solid red fill with a pulsing dot*;
  everything else is a quiet tint. A glance answers "what needs attention?" Use `StatusBadge`.
- **Data density over decoration.** 14px base, tables and cards over hero art. Whitespace
  organizes; it doesn't pad for its own sake. A board of identical stock banners is noise.
- **One accent.** Brand blue marks the primary action and the active state — nothing else
  competes for "this is the thing to click."
- **Calm motion.** Hover, and the LIVE pulse. Both stop under `prefers-reduced-motion`.
- **Never promise what isn't there.** No button for a feature the data can't back; no number
  the data can't support. "0 teams" because the payload forgot to include the count is a lie —
  omit the stat instead.

## 2. Tokens

### 2.1 Colour

Values are oklch and live in `globals.css`. The Subtick palette (`--bg-*`, `--ink-*`,
`--line-*`, `--accent*`, semantics) is the base; the legacy `--mds-*` names are aliases onto it,
and Tailwind exposes both layers under one semantic vocabulary.

| Tailwind | Token | Role |
|---|---|---|
| `bg-page` | `--bg-0` | App background |
| `bg-card` / `bg-card-hover` | `--bg-1` / `--bg-2` | Surfaces |
| `bg-surface-0…4` | `--bg-0…4` | Raw surface steps when page/card isn't enough |
| `bg-field` | `--mds-input` | Form fields |
| `border-line` / `border-line-hover` / `border-line-strong` | `--line-0/1/2` | Borders |
| `bg-tint` / `bg-tint-strong` / `bg-tint-faint` | `--tint-1/2/3` | Theme-aware overlay fills |
| `bg-brand` / `bg-brand-hover` / `bg-brand-soft` / `text-brand-ink` | `--accent*` | Primary action, active state |
| `text-success` / `text-danger` / `text-warning` | `--win` / `--loss` / `--warn` | Ready / error / pending |
| `bg-live` / `text-live` / `text-live-ink` | `--live*` | **LIVE only.** Not "danger" — a live match is not an error |
| `text-team-t` / `text-team-ct` (+ `-dim`, `-ghost`) | `--t*` / `--ct*` | CS2 side coding |
| `text-fg` / `fg-soft` / `fg-muted` / `fg-subtle` / `fg-faint` | `--ink-0…4` | Ink ramp |
| `bg-scrim` / `bg-overlay` | `--scrim` / `--mds-overlay` | Modal backdrops |
| `ring` (and the global focus ring) | `--ring` | Keyboard focus — stays visible *on* the accent |

**`bg-tint` replaces `bg-white/5`.** A white alpha fill is invisible on a white page; the tint
tokens flip to black alpha in the light theme, so one class works in both.

### 2.2 Type scale — and the 11px floor

Seven steps, in `globals.css` as `--fs-*`, in Tailwind as `text-label … text-score`:

| Utility | Size | Use |
|---|---|---|
| `text-label` | **11px** | Uppercase labels, eyebrows, badges, table headers. **The floor.** |
| `text-meta` | 12px | Metadata, stat rows, hints, timestamps |
| `text-body` | 14px | Default UI and body copy |
| `text-lead` | 16px | Emphasised body, long-form, names in a match row |
| `text-title` | 20px | Card and section titles (`h3`, `.mds-card-title`) |
| `text-head` | 28px | Section heads (`h2`) |
| `text-display` | fluid 32–44px | Page titles (`h1`, `.workspace-title`) |
| `text-score` | 40px | Scores and clocks read from across the room |

**Nothing below 11px ships.** `text-[10px]`, `text-[9px]` and `text-[8px]` are bugs, not styles:
this product is operated in a dim venue by someone standing up and under time pressure.
Likewise **`font-black` is a bug** — the loaded faces stop at 700, so 900 is a synthetic fake.
Use `font-bold`.

### 2.3 The light theme is real

`[data-theme='light']` redefines the whole Subtick palette (surfaces, ink, lines, semantics,
accent, tints, shadows). Because every `--mds-*` alias and every Tailwind utility is declared in
terms of those vars, and custom properties resolve per element, the entire app follows with no
per-component work. Semantic hues are **darkened, not inverted** (a dark-mode green at L 0.79 is
unreadable on white).

If you add a token, add it to **both** blocks. A token defined only in `:root` silently keeps its
dark value in light mode — that is exactly how the old stub broke.

### 2.4 Migration: reaching past the layer

| Instead of | Write |
|---|---|
| `bg-[var(--mds-card)]` | `bg-card` |
| `text-[var(--mds-text-muted)]` | `text-fg-muted` |
| `border-[var(--mds-border)]` | `border-line` |
| `text-[var(--mds-action)]` | `text-brand` |
| `bg-white/5`, `rgba(255,255,255,.05)` | `bg-tint` |
| `text-[10px] font-black uppercase tracking-widest` | `mds-uppercase-label`, or `text-label font-bold uppercase tracking-widest` on a button |
| `text-xs` / `text-sm` / `text-base` | `text-meta` / `text-body` / `text-lead` |
| a raw hex | the nearest token above; if there isn't one, add it to `tailwind.config.ts` |

## 3. Typography

Three faces, one job each (loaded in `src/app/layout.tsx`; the variables go on `<html>`, never
on `<body>` — they are declared on `:root` and a `<body>`-only application silently fell back to
serif in production once already).

| Face | Variable / Tailwind | Job |
|---|---|---|
| **Inter** | `--sans`, `font-sans`, `--mds-font-body` | Prose, UI, labels, and **every name a human typed** |
| **JetBrains Mono** | `--mono`, `font-mono`, `--mds-font-mono` | **Numerics only** — scores, seeds, seat labels, clocks, invite codes |
| **Martian Mono** | `--display`, `font-brand` | The Summit wordmark and page titles |

Inter was picked over the all-mono identity because the identity was costing width: a
proportional face runs ~15% narrower at the same size, which is the difference between
"Kristiansand Kings" fitting and "KRISTIANSAND KIN…". It has the x-height and open apertures to
survive 12–14px in a dim room, and real tabular figures. The tactical character now lives where
it reads as deliberate — the wordmark, the page titles, and every number on screen.

### The contract: shout on labels, never on content

| Kind | Class | Style |
|---|---|---|
| **Label** — section markers, field labels, eyebrows, metadata | `.mds-uppercase-label` | uppercase, 0.1em tracking, 11px, muted |
| **Content** — team, player and tournament names | `.mds-name` / `.mds-name-lg` | proportional, the user's own casing, **no tracking**, wraps |
| **Numeric** — scores, seeds, seat labels, clocks, invite codes | `.mds-numeric` | **JetBrains Mono** + tabular figures, never wraps |
| **Counts inside prose** — "12 listed", "3 of 8" | `.mds-tabular` | tabular figures, keeps the proportional face |

**`.mds-numeric` carries the mono family itself.** That is the entire migration path: a call
site that already uses the class needs no edit. Anything that has to line up in a column or be
read out loud across a room wears it.

`.mds-numeric` does **not** enable the slashed zero: JetBrains Mono's slashed zero reads as an 8
at label size ("20 listed" became "28 listed" on the directory board).

**Never put `uppercase tracking-*` on a value a human typed.** `KRISTIANSAND KIN…` is a bug.

### Names must survive

Let names **wrap** (`.mds-name` sets `overflow-wrap: anywhere`); where a rail genuinely cannot
grow, use `.mds-clamp-2` (two lines) rather than `truncate`. Reserve `truncate` for places where
the full value is also shown elsewhere. Never set a fixed `max-w-[…px]` on a name.

## 4. Components (`src/components/ui/`)

| Component | Use |
|---|---|
| `Button` | `primary` / `secondary` / `ghost` / `danger`, sizes `sm`/`md`. Defaults to `type="button"`. |
| `Card` | Surface container; `interactive` for clickable cards. |
| `CardTitle` | **The default card heading** — `.mds-card-title`, i.e. a *name*, not an uppercase label. `as` picks the level, `clamp` caps it at two lines. |
| `Badge` / `StatusBadge` | Tones: `live`/`ready`/`pending`/`done`/`danger`/`info`/`neutral`. `StatusBadge` maps any match status *or* tournament stage to a tone + a human label. |
| `StatusDot` | The same vocabulary as a 7px dot, for rows too dense for a badge. Always pair it with a word. |
| `Input` | Labelled field, optional `hint` and leading `icon`. |
| `EmptyState` | Zero states for lists and boards. |
| `PageHeader` | Eyebrow + title + subtitle + `meta` (a status line) + right-aligned `actions`. |
| `TournamentCard` | One tournament as it appears on any board. The landing page and the directory render the same component, so a tournament reads identically wherever you meet it. |
| `TopNav` | The single persistent, role-aware app header. |

`StatusBadge` never renders a raw enum: unknown statuses fall through a humanizer
(`SOME_NEW_STATUS` → "Some new status"), so a new status added to the DB degrades to words.

### Utility classes (`globals.css`)

| Class | Use |
|---|---|
| `.mds-card-grid` | The board grid. `auto-fit` so two cards fill the row instead of leaving a third of the screen empty. |
| `.mds-section-head` | The label + count + link row above a board. |
| `.mds-stat-row` / `.mds-stat` | The metadata line under a name (format, teams, roster). |
| `.mds-dot` + `.is-live/.is-ready/.is-pending/.is-done` | Status dot. |
| `.mds-live-panel` | The "happening now" surface: red rule, faint red wash. Nothing else may look like this. |
| `.mds-card-title`, `.mds-name`, `.mds-name-lg`, `.mds-numeric`, `.mds-tabular`, `.mds-clamp-2`, `.mds-uppercase-label` | Typography contract (§3). |
| `.mds-tap` | 44px minimum hit area on touch devices, with no visual change on a mouse. |
| `.mds-card`, `.mds-btn-*`, `.mds-input`, `.mds-table`, `.mds-badge`, `.mds-empty-state`, `.workspace-*` | The base surfaces. Prefer the React components. |

## 5. Layout, focus and touch

- Content max width `--mds-max-content` (1400px) via `.mds-container` / `max-w-content`;
  32px side gutters, 16px below 640px.
- Radius: `rounded-sm` (4px) controls, `rounded`/`rounded-md` (7px), `rounded-lg` (11px) cards.
- **Focus** is global: every interactive element gets a 2px `--ring` outline at 2px offset via a
  zero-specificity `:where()` rule. Don't remove it; don't reimplement it per component.
- **Touch**: `.mds-tap` gives 44px on `pointer: coarse` only.
- The header carries a "Skip to content" link; `NavigationWrapper` provides its `#main` target
  on every chromed page.
- Modals trap focus, close on Escape, lock the page behind them, and return focus to whatever
  opened them (see `CommandPalette`).

## 6. Surfaces (information architecture)

- **Public / Spectator** — landing board, directory, brackets, schedule, live scores, rosters,
  OBS overlay. No login. The landing page leads with *what is being played right now*.
- **Player** — Steam login: register, team invite link, queue position, notifications.
- **Control** — admin (`/admin`) + marshal (`/marshal/dashboard`). Day-to-day: `docs/LAN-RUNBOOK.md`.


### Alpha modifiers on tokens

Every colour token is declared through `color-mix(... <alpha-value> ...)` in `tailwind.config.ts`,
so `bg-danger/15`, `border-brand/30` and friends compile. **Do not "simplify" a token back to a
bare `var(--x)`**: Tailwind then emits *nothing at all* for the `/alpha` variant, so the tint
silently vanishes rather than failing loudly. Solid usage is unaffected either way, which is
exactly what makes the regression hard to spot.

## 7. Do / Don't

**Do** use the Tailwind semantic utilities; use `StatusBadge` for any match/tournament state;
keep one brand accent per view; let names wrap; design for a dim room.

**Don't** write `var(--mds-*)` or a hex in a component; don't invent a font size (§2.2); don't
use `font-black`; don't add an accent colour; don't style status ad-hoc; don't uppercase or
letter-space a name; don't render a raw enum (`SINGLE_ELIMINATION`) or an id fragment; don't
ship a control — or a number — the data can't back.

**Motion** is hover plus the LIVE pulse, and the pulse means *this is being played right now*.
Tailwind's `animate-pulse` is currently on things that are not live — a "Save seeds" button, a
queue icon, a "live tournament page" dot — which spends the one signal the room reads fastest.
If something is live, use `StatusBadge`/`StatusDot`; if it is merely important, it can be still.
