import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';
import { requireAdminApi } from '@/lib/route-auth';
import { buildActorLabel, recordAudit } from '@/lib/audit';

/** GET — current EON bridge status (admin). */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const tournament = await prisma.tournament.findUnique({
    where: { id: params.id },
    select: { id: true, eonBridgeToken: true },
  });
  if (!tournament) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({
    enabled: Boolean(tournament.eonBridgeToken),
    token: tournament.eonBridgeToken,
  });
}

/** POST { action: 'enable' | 'disable' | 'rotate' } — mint/clear the bridge token (admin). */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const unauthorized = await requireAdminApi();
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const action = body?.action;

  if (action === 'disable') {
    await prisma.tournament.update({ where: { id: params.id }, data: { eonBridgeToken: null } });
    await recordAudit({
      action: 'eon_bridge.disabled',
      entityType: 'tournament',
      entityId: params.id,
      tournamentId: params.id,
      summary: 'Disabled EON live-score bridge',
      actor: await buildActorLabel(),
    });
    return NextResponse.json({ enabled: false, token: null });
  }

  if (action === 'enable' || action === 'rotate') {
    const token = `eon_${randomBytes(20).toString('hex')}`;
    await prisma.tournament.update({ where: { id: params.id }, data: { eonBridgeToken: token } });
    await recordAudit({
      action: action === 'rotate' ? 'eon_bridge.rotated' : 'eon_bridge.enabled',
      entityType: 'tournament',
      entityId: params.id,
      tournamentId: params.id,
      summary: action === 'rotate' ? 'Rotated EON bridge token' : 'Enabled EON live-score bridge',
      actor: await buildActorLabel(),
    });
    return NextResponse.json({ enabled: true, token });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}
