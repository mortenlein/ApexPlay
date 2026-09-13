/**
 * Locale configuration.
 *
 * No locale segment in the URL. The locale lives in a cookie (and, for a signed-in user, on
 * their row so push notifications can be written in their language). Rationale: putting
 * /nb/ and /en/ in the path would mean restructuring every route into a [locale] segment and
 * rewriting every link and test, to buy SEO that a LAN tool does not need. This is reversible
 * later if a public site ever wants it.
 */
export const LOCALES = ['nb', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Norwegian first: this is a Norwegian youth club. English is served to everyone else. */
export const DEFAULT_LOCALE: Locale = 'nb';

export const LOCALE_COOKIE = 'summit.locale';
/** A year: a player sets this once at their first LAN and should never think about it again. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export const LOCALE_LABELS: Record<Locale, string> = {
  nb: 'Norsk',
  en: 'English',
};

/** The BCP-47 tag for <html lang>, which is not always the same string as our locale key. */
export const HTML_LANG: Record<Locale, string> = {
  nb: 'nb-NO',
  en: 'en',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Best locale for an Accept-Language header. Norwegian in any of its spellings (nb, nn, no)
 * resolves to Norwegian; anything else we can't serve falls back to English rather than to the
 * default, because a visitor whose browser is explicitly not Norwegian is precisely the
 * "non-Norwegian friend" case.
 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const tags = header
    .split(',')
    .map((part) => {
      const [tag, q] = part.trim().split(';q=');
      return { tag: tag.trim().toLowerCase(), q: q ? Number(q) : 1 };
    })
    .filter((t) => t.tag)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of tags) {
    if (tag === '*') continue;
    const primary = tag.split('-')[0];
    if (primary === 'nb' || primary === 'nn' || primary === 'no') return 'nb';
    if (primary === 'en') return 'en';
  }
  return null;
}
