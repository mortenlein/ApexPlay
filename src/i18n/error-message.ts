'use client';

import { useTranslations } from 'next-intl';
import { errorCodeOf, errorParamsOf } from '@/lib/api-errors';

/**
 * Turns a failed request into the sentence a human should read, in their own language.
 *
 * The server sends both halves of a refusal — `error` (English, for the log and for `curl`) and
 * `code` (the key in the `errors` namespace). This resolves the code, and degrades in steps: an
 * uncoded refusal (most 500s) shows the server's own English text, then whatever the thrown error
 * said, then the caller's fallback. A missing translation has to end in a worse sentence, never
 * in a blank toast or a raw message key.
 *
 * Takes an `ApiError` (`payload` is the parsed body), a raw parsed body, or any Error.
 */
export function useApiErrorMessage() {
  const t = useTranslations('errors');

  return (error: unknown, fallback?: string): string => {
    const code = errorCodeOf(error);
    if (code && t.has(code)) {
      return t(code, errorParamsOf(error));
    }

    const body = (error as { payload?: unknown })?.payload ?? error;
    const serverText = (body as { error?: unknown })?.error;
    if (typeof serverText === 'string' && serverText) return serverText;

    if (error instanceof Error && error.message) return error.message;
    return fallback ?? '';
  };
}
