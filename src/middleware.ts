import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { isAdminSteamId, isStaffSteamId } from '@/lib/admin-config';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAdminArea =
    pathname.startsWith('/admin') || pathname.startsWith('/dashboard/tournaments');
  const isMarshalArea = pathname.startsWith('/marshal');

  if (isAdminArea || isMarshalArea) {
    const token = await getToken({
      req: request,
      secret: process.env.NEXTAUTH_SECRET,
    });
    const steamId = token?.steamId as string | undefined;

    // /marshal is open to staff (admins + marshals); /admin stays admin-only.
    const allowed = isMarshalArea ? isStaffSteamId(steamId) : isAdminSteamId(steamId);

    if (!allowed) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/dashboard/tournaments/:path*', '/marshal/:path*'],
};
