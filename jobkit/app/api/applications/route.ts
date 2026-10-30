import { listApplications } from '@/lib/db/repo';
import { handler, json } from '@/lib/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** 검색은 브라우저에서 한다 (전화번호가 요청 URL/로그에 남지 않도록). */
export const GET = handler(async () => {
  const apps = listApplications().map(({ posting_text: _p, parsed_json: _j, ...rest }) => rest);
  return json({ applications: apps });
});
