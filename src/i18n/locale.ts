import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, localeFromAcceptLanguage, type Locale } from './config';

/**
 * The locale for the current request, server side.
 *
 * Order of precedence:
 *   1. the cookie — an explicit choice the user made, so it always wins;
 *   2. Accept-Language — a Norwegian phone gets Norwegian, a British one gets English,
 *      neither has to touch a setting;
 *   3. Norwegian.
 *
 * A signed-in user's stored preference is written to the cookie when they switch, so it does
 * not need a database read on every render.
 */
export async function getRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(fromCookie)) return fromCookie;

  const headerList = await headers();
  const detected = localeFromAcceptLanguage(headerList.get('accept-language'));
  return detected ?? DEFAULT_LOCALE;
}
