import { z } from 'zod';
import { deleteApplication, getApplication, updateApplication } from '@/lib/db/repo';
import { errorJson, handler, json, parseId } from '@/lib/server/http';
import { fileNames } from '@/lib/server/service';
import { APPLICATION_STATUSES } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler(async (_req: Request, ctx: Ctx) => {
  const id = parseId((await ctx.params).id);
  const app = id ? getApplication(id) : null;
  if (!app) return errorJson('지원 이력을 찾을 수 없습니다.', 404);
  return json({ application: app, files: fileNames(app) });
});

const Patch = z
  .object({
    status: z.enum(APPLICATION_STATUSES).optional(),
    memo: z.string().max(20_000).optional(),
    mail_subject: z.string().max(500).optional(),
    mail_body: z.string().max(20_000).optional(),
    selected_email: z.string().max(200).nullable().optional(),
    phone: z.string().max(100).optional(),
  })
  .strict();

export const PATCH = handler(async (req: Request, ctx: Ctx) => {
  const id = parseId((await ctx.params).id);
  if (!id || !getApplication(id)) return errorJson('지원 이력을 찾을 수 없습니다.', 404);
  const patch = Patch.parse(await req.json());
  return json({ application: updateApplication(id, patch) });
});

export const DELETE = handler(async (_req: Request, ctx: Ctx) => {
  const id = parseId((await ctx.params).id);
  if (!id) return errorJson('잘못된 요청입니다.', 400);
  deleteApplication(id);
  return json({ ok: true });
});
