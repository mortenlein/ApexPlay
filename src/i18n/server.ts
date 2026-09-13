import { getTranslations } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale, type Locale } from './config';

/**
 * Translations for copy that is composed **without a request to read the locale from**.
 *
 * Everything in `src/i18n/request.ts` answers the question "what language is this browser
 * asking in?". Three surfaces can't ask it:
 *
 *  - a web push, written minutes after the player last loaded a page, on a server that only
 *    knows their user id → the language comes from `User.locale` (see `lib/push.ts`);
 *  - a Discord post, read by a whole channel at once → one configured language, `DISCORD_LOCALE`;
 *  - an API refusal, which is composed for a log first and a human second (see `lib/api-errors.ts`).
 *
 * `getRequestConfig` honours an explicit locale override, so `getTranslations({locale})` returns
 * that language's catalogue regardless of whose request happens to be on the stack — which is the
 * whole point here: the marshal calling the match is not the player being notified.
 */

/**
 * The language to write to a user in: their stored choice, else Norwegian.
 *
 * `locale: null` is the common case, not an error — most players never touch the switch, and this
 * is a Norwegian club, so silence means bokmål.
 */
export function userLocale(value: string | null | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * The one language the Discord channel is written in. A channel is read by everybody at once, so
 * there is nobody to personalise for — it is a deployment decision, not a user preference.
 */
export function discordLocale(): Locale {
  const configured = process.env.DISCORD_LOCALE;
  return isLocale(configured) ? configured : DEFAULT_LOCALE;
}

/** English, always — for records kept by staff (the marshal feed, the audit log). */
export const LOG_LOCALE: Locale = 'en';

export type ServerTranslations = Awaited<ReturnType<typeof getTranslations>>;

/** `getTranslations`, with the locale stated rather than inferred from the request. */
export async function getServerTranslations(locale: Locale, namespace: string): Promise<ServerTranslations> {
  return getTranslations({ locale, namespace });
}
