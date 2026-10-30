import fs from 'node:fs';
import path from 'node:path';
import { getProfile, setPhotoFile } from '@/lib/db/repo';
import { dataDir, resolveDataPath } from '@/lib/paths';
import { checkProfile } from '@/lib/render/compose';
import { errorJson, handler, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX = 5 * 1024 * 1024;

function sniff(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

function removeOld() {
  const old = getProfile().photo_file;
  if (old) fs.rmSync(resolveDataPath(old), { force: true });
}

export const POST = handler(async (req: Request) => {
  const form = await req.formData();
  const file = form.get('photo');
  if (!(file instanceof File)) return errorJson('사진 파일을 선택하세요.');
  if (file.size > MAX) return errorJson('사진은 5MB 이하만 올릴 수 있습니다.');
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) return errorJson('JPG, PNG, WEBP 이미지만 올릴 수 있습니다.');
  removeOld();
  const rel = path.join('photo', `photo-${Date.now()}.${ext}`);
  fs.mkdirSync(path.join(dataDir(), 'photo'), { recursive: true });
  fs.writeFileSync(resolveDataPath(rel), buf);
  setPhotoFile(rel);
  return json({ ok: true, check: checkProfile(getProfile()) });
});

export const DELETE = handler(async () => {
  removeOld();
  setPhotoFile(null);
  return json({ ok: true, check: checkProfile(getProfile()) });
});
