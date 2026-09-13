# i18n conventions

Two languages: **nb** (bokmål, the default) and **en**. Terminology lives in
`docs/i18n-glossary-nb.md` — read it before writing a single Norwegian string.

## How it is wired

- **No locale in the URL.** The locale comes from a cookie, falling back to `Accept-Language`,
  falling back to Norwegian (`src/i18n/config.ts`, `src/i18n/locale.ts`). Every existing URL and
  every existing test keeps working. This is reversible if a public site ever wants `/nb/`.
- `src/i18n/request.ts` feeds `next-intl`; the provider is mounted in `src/app/layout.tsx`,
  which also sets `<html lang>`.
- Switching writes `POST /api/me/locale`, which sets the cookie **and**, for a signed-in user,
  `User.locale` — push notifications are composed on the server long after that request is gone,
  and a Norwegian 12-year-old should not get an English alert.
- Messages: **one file per namespace per locale** — `messages/<locale>/<namespace>.json`, listed
  in `messages/index.ts` and merged at request time. A single catalogue would turn every
  simultaneous translator into a merge conflict in the same file; a namespace per surface means
  each owner touches only their own. **Both languages must always have identical keys** —
  `npm run i18n:check` fails otherwise, and also rejects empty strings, which are almost always
  an unfinished translation rather than an intended blank.

## Writing strings

```tsx
// Client or Server Component — next-intl supports both.
import { useTranslations } from 'next-intl';
const t = useTranslations('player');
<p>{t('matchesAhead', { count })}</p>
```

Namespaces follow surfaces: `common`, `status`, `stage`, `nav`, `landing`, `directory`,
`tournament`, `player`, `register`, `marshal`, `organizer`, `errors`.
`common.*` is for genuinely shared words (Save, Cancel, Seat). If a string appears on one
surface, it belongs to that surface's namespace, not `common`.

## Rules

1. **Never concatenate.** `t('x') + ' ' + name` breaks on any language with different word
   order. Interpolate: `t('greeting', { name })`.
2. **Plurals go through ICU**, never `n === 1 ? 'match' : 'matches'`:
   `"matchesAhead": "{count, plural, one {# kamp foran deg} other {# kamper foran deg}}"`.
3. **Norwegian definite form is a suffix** (*kampen*, *laget*), so a sentence that needs it
   cannot take a raw `{name}`. Phrase around it.
4. **Compounds are one word** in Norwegian: *kampoppsett*, not *kamp oppsett*. Splitting them is
   the loudest marker of machine-translated Norwegian.
5. **Status words are not yours.** A match state renders via `matchStatusKey()` +
   `t('status.*')`. Do not invent a second vocabulary — that bug has already been fixed twice.
6. **Do not translate**: `LAN`, `live`, `crew`, `overlay`, `Steam`, `Discord`, `CS2`,
   `BO1/BO3/BO5`, `walkover`. Forcing these into Norwegian reads worse, not better.
7. **Leave ids, codes and seats alone.** They are `.mds-numeric`, not language.

## Tests

The suite is pinned to English by a cookie in `playwright.config.ts`, so the 201 existing
assertions keep asserting English. Norwegian has its own spec, `e2e/i18n-locale.spec.ts`.
If you add a translated string that a test asserts, the test stays English — do not translate
assertions.
