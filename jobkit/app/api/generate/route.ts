import { z } from 'zod';
import { ParsedSchema } from '@/lib/parser/schema';
import { errorJson, handler, json } from '@/lib/server/http';
import { generateForPosting } from '@/lib/server/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  text: z.string().max(100_000),
  parsed: z.unknown(),
  extraDocs: z.array(z.string().max(100)).max(10).default([]),
  applicationId: z.number().int().nullable().optional(),
});

export const POST = handler(async (req: Request) => {
  const body = Body.parse(await req.json());
  const parsed = ParsedSchema.parse(body.parsed);
  if (!parsed.site.trim() || !parsed.title.trim()) return errorJson('단지/사업장명과 직책을 먼저 입력하세요.', 400);
  const res = await generateForPosting({ text: body.text, parsed, extraDocs: body.extraDocs, applicationId: body.applicationId ?? null });
  return json(res);
});
