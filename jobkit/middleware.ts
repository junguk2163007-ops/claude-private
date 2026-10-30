import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

const PUBLIC = ['/login', '/api/auth/login', '/robots.txt'];

function withHeaders(res: NextResponse) {
  res.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith('/api/');

  // 상태를 바꾸는 API 요청은 같은 출처에서만 (CSRF 방지)
  if (isApi && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.get('origin');
    if (origin) {
      const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
      let ok = false;
      try {
        ok = new URL(origin).host === host;
      } catch {
        ok = false;
      }
      if (!ok) return withHeaders(NextResponse.json({ error: '허용되지 않은 요청입니다.' }, { status: 403 }));
    }
  }

  if (PUBLIC.includes(pathname)) return withHeaders(NextResponse.next());

  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return withHeaders(NextResponse.next());

  if (isApi) return withHeaders(NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 }));
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.search = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
  return withHeaders(NextResponse.redirect(url));
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
