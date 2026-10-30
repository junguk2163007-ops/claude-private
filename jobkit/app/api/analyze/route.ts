import { z } from 'zod';
import { parsePosting } from '@/lib/parser';
import { ParsedSchema } from '@/lib/parser/schema';
import { handler, json } from '@/lib/server/http';
import { profileCheck, runAnalysis } from '@/lib/server/service';
import { todaySeoul } from '@/lib/util/date';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  text: z.string().max(100_000),
  parsed: z.unknown().optional(),
  applicationId: z.number().int().nullable().optional(),
});

/** parsed 가 없으면 원문을 파싱하고, 있으면(사용자가 폼을 고친 경우) 그 값으로 분석만 다시 한다. */
export const POST = handler(async (req: Request) => {
  const body = Body.parse(await req.json());
  const parsed = body.parsed ? ParsedSchema.parse(body.parsed) : parsePosting(body.text, todaySeoul());
  const analysis = runAnalysis(body.text, parsed, body.applicationId ?? null);
  return json({ parsed, analysis, profileCheck: profileCheck(), today: todaySeoul() });
});
