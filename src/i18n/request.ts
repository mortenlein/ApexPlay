import { getRequestConfig } from 'next-intl/server';
import { getRequestLocale } from './locale';
import { loadMessages } from '../../messages';

/**
 * next-intl request config. No routing segment: the locale comes from the cookie /
 * Accept-Language (see ./locale.ts), so every existing URL keeps working untouched.
 */
export default getRequestConfig(async () => {
  const locale = await getRequestLocale();
  return {
    locale,
    messages: await loadMessages(locale),
    // One place to change how dates and numbers read, rather than per call site.
    timeZone: 'Europe/Oslo',
    now: new Date(),
  };
});
