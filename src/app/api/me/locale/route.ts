import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSignedInUser } from '@/lib/route-auth';
import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isLocale } from '@/i18n/config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/me/locale  { locale: 'nb' | 'en' }
 *
 * Sets the UI language. Always writes the cookie (so an anonymous spectator can switch too);
 * additionally stores it on the user row when signed in, because push notifications are
 * composed on the server long after the request that set this has gone.
 */
export async function POST(request: Request) {
    const body = await request.json().catch(() => ({}));
    const locale = body?.locale;

    if (!isLocale(locale)) {
        return NextResponse.json({ error: 'Unsupported locale' }, { status: 400 });
    }

    const session = await requireSignedInUser();
    const userId = (session?.user as any)?.id as string | undefined;
    if (userId) {
        // Best-effort: a failed write must not stop the user changing language.
        await prisma.user.update({ where: { id: userId }, data: { locale } }).catch(() => {});
    }

    const response = NextResponse.json({ locale });
    response.cookies.set(LOCALE_COOKIE, locale, {
        maxAge: LOCALE_COOKIE_MAX_AGE,
        path: '/',
        sameSite: 'lax',
    });
    return response;
}
