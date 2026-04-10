import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import prisma from '@/lib/prisma';
import { requireSignedInUser, isAdminAuthenticated } from '@/lib/route-auth';

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const tournamentId = formData.get('tournamentId');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const isAdmin = await isAdminAuthenticated();
    const session = await requireSignedInUser();

    if (!isAdmin && !session?.user) {
      if (typeof tournamentId !== 'string' || !tournamentId) {
        return NextResponse.json({ error: 'Sign in required for uploads' }, { status: 401 });
      }

      const tournament = await prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { steamSignupEnabled: true },
      });

      if (!tournament || tournament.steamSignupEnabled) {
        return NextResponse.json({ error: 'Sign in required for uploads' }, { status: 401 });
      }
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPG, and WEBP files are allowed' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large. Max size is 2MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a unique filename
    const ext = file.name.split('.').pop();
    const filename = `${uuidv4()}.${ext}`;
    
    // Ensure directory exists
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'logos');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {
      // Ignore if exists
    }

    const path = join(uploadDir, filename);
    await writeFile(path, buffer);

    const logoUrl = `/uploads/logos/${filename}`;
    return NextResponse.json({ url: logoUrl });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
