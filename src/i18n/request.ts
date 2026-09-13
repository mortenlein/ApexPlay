import { getRequestConfig } from 'next-intl/server';
import { isLocale } from './config';
import { getRequestLocale } from './locale';
import { loadMessages } from '../../messages';

/**
 * next-intl request config. No routing segment: the locale comes from the cookie /
 * Accept-Language (see ./locale.ts), so every existing URL keeps working untouched.
 *
 * `locale` is set when a caller states the language instead of asking for the request's —
 * `getTranslations({locale})` from `./server.ts`, used to write a push notification in the
 * *recipient's* language, which is not the language of the marshal whose request is on the
 * stack. Ignoring it here would silently compose every notification in the caller's locale.
 */
export default getRequestConfig(async ({ locale: requested }) => {
  const locale = isLocale(requested) ? requested : await getRequestLocale();
  return {
    locale,
    messages: await loadMessages(locale),
    // One place to change how dates and numbers read, rather than per call site.
    timeZone: 'Europe/Oslo',
    now: new Date(),
  };
});
