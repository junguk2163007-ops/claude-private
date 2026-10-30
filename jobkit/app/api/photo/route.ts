import { readPhoto } from '@/lib/db/repo';
import { errorJson, handler } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 증명사진은 인증된 라우트로만 제공한다 (public 폴더에 두지 않음) */
export const GET = handler(async () => {
  const p = readPhoto();
  if (!p) return errorJson('사진이 없습니다.', 404);
  return new Response(new Uint8Array(p.data), { headers: { 'Content-Type': p.mime, 'Cache-Control': 'private, no-store' } });
});
