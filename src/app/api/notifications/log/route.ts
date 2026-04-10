import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAdminApi } from '@/lib/route-auth';

export async function GET(request: Request) {
    const unauthorized = await requireAdminApi();
    if (unauthorized) return unauthorized;

    try {
        const tournamentId = new URL(request.url).searchParams.get('tournamentId');
        const notifications = await prisma.notificationLog.findMany({
            where: tournamentId ? { tournamentId } : undefined,
            orderBy: { createdAt: 'desc' },
            take: 100,
        });

        return NextResponse.json({ 
            notifications: notifications.map((notification) => ({
                id: notification.id,
                timestamp: notification.createdAt.toISOString(),
                type: notification.type,
                embed: {
                    title: notification.title,
                    description: notification.description || '',
                },
            })),
            count: notifications.length 
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
