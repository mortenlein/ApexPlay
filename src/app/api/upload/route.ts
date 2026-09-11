import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { requireSignedInUser, isAdminAuthenticated } from '@/lib/route-auth';

const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
// Extension is derived from the (validated) MIME type, never from the user-supplied filename —
// see the write path below. A filename like "x.png/../../evil" would otherwise traverse out.
const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};
const ALLOWED_MIME_TYPES = new Set(Object.keys(EXT_BY_MIME));

export async function POST(request: Request) {
  try {
    // Uploads always require an identity — there is no anonymous registration any more.
    // Checked before the body is parsed so anonymous callers never make us buffer a file.
    const isAdmin = await isAdminAuthenticated();
    const session = await requireSignedInUser();

    if (!isAdmin && !session?.user) {
      return NextResponse.json({ error: 'Sign in required for uploads' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPG, and WEBP files are allowed' }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large. Max size is 2MB' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Unique filename with a MIME-derived extension (no user input in the path).
    const filename = `${uuidv4()}.${EXT_BY_MIME[file.type]}`;
    
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
