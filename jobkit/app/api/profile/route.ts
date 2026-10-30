import { getProfile, saveProfile } from '@/lib/db/repo';
import { checkProfile } from '@/lib/render/compose';
import { handler, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async () => {
  const profile = getProfile();
  return json({ profile, check: checkProfile(profile) });
});

export const PUT = handler(async (req: Request) => {
  const { photo_file: _ignored, ...data } = (await req.json()) as Record<string, unknown>;
  saveProfile(data);
  const profile = getProfile();
  return json({ profile, check: checkProfile(profile) });
});
