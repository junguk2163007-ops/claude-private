import { getBlocks, saveBlocks } from '@/lib/db/repo';
import { handler, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async () => json({ blocks: getBlocks() }));
export const PUT = handler(async (req: Request) => json({ blocks: saveBlocks(await req.json()) }));
