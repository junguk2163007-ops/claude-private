import { listQualifications, saveQualifications } from '@/lib/db/repo';
import { handler, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async () => json({ qualifications: listQualifications() }));
export const PUT = handler(async (req: Request) => json({ qualifications: saveQualifications(await req.json()) }));
