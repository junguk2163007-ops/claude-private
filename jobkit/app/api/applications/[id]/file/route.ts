import fs from 'node:fs';
import { getApplication } from '@/lib/db/repo';
import { resolveDataPath } from '@/lib/paths';
import { errorJson, handler, parseId } from '@/lib/server/http';
import { fileNames } from '@/lib/server/service';
import { contentDisposition } from '@/lib/util/filename';
import { makeZip } from '@/lib/util/zip';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** 인증된 사용자에게만 PDF/zip 제공. ?kind=resume|letter|zip&download=1 */
export const GET = handler(async (req: Request, ctx: Ctx) => {
  const id = parseId((await ctx.params).id);
  const app = id ? getApplication(id) : null;
  if (!app) return errorJson('지원 이력을 찾을 수 없습니다.', 404);
  const url = new URL(req.url);
  const kind = url.searchParams.get('kind') ?? 'resume';
  const download = url.searchParams.get('download') === '1';
  const names = fileNames(app);
  const read = (rel: string | null) => (rel && fs.existsSync(resolveDataPath(rel)) ? fs.readFileSync(resolveDataPath(rel)) : null);
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };

  if (kind === 'zip') {
    const r = read(app.resume_pdf_path);
    const l = read(app.letter_pdf_path);
    if (!r || !l) return errorJson('PDF 파일이 없습니다. 서류를 다시 생성하세요.', 404);
    const zip = makeZip([
      { name: names.resume, data: r },
      { name: names.letter, data: l },
    ]);
    return new Response(new Uint8Array(zip), {
      headers: { ...headers, 'Content-Type': 'application/zip', 'Content-Disposition': contentDisposition(names.zip, 'attachment', `documents-${app.id}.zip`) },
    });
  }
  const isResume = kind === 'resume';
  const buf = read(isResume ? app.resume_pdf_path : app.letter_pdf_path);
  if (!buf) return errorJson('PDF 파일이 없습니다. 서류를 다시 생성하세요.', 404);
  return new Response(new Uint8Array(buf), {
    headers: {
      ...headers,
      'Content-Type': 'application/pdf',
      'Content-Disposition': contentDisposition(
        isResume ? names.resume : names.letter,
        download ? 'attachment' : 'inline',
        `${isResume ? 'resume' : 'cover-letter'}-${app.id}.pdf`,
      ),
    },
  });
});
