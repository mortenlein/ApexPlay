import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminApi } from '@/lib/route-auth';

export async function GET(request: Request) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId');
  const limit = Number.parseInt(searchParams.get('limit') || '40', 10);

  const entries = await prisma.auditLog.findMany({
    where: tournamentId ? { tournamentId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: Number.isNaN(limit) ? 40 : Math.min(limit, 100),
  });

  return NextResponse.json({
    entries: entries.map((entry) => ({
      ...entry,
      createdAt: entry.createdAt.toISOString(),
      metadata: entry.metadata ? JSON.parse(entry.metadata) : null,
    })),
  });
}
