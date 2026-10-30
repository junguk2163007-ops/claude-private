import { NextResponse } from 'next/server';
import { checkPassword, createSessionToken, passwordConfigured, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/session';
import { clientIp, lockedFor, recordFailure, recordSuccess } from '@/lib/auth/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  if (!passwordConfigured()) {
    return NextResponse.json({ error: '서버에 APP_PASSWORD 환경변수가 설정되지 않았습니다.' }, { status: 503 });
  }
  const ip = clientIp(req.headers);
  const wait = lockedFor(ip);
  if (wait > 0) {
    return NextResponse.json(
      { error: `로그인 시도가 너무 많습니다. ${Math.ceil(wait / 60)}분 뒤에 다시 시도하세요.` },
      { status: 429, headers: { 'Retry-After': String(wait) } },
    );
  }
  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  const ok = typeof body.password === 'string' && body.password.length <= 500 && (await checkPassword(body.password));
  if (!ok) {
    recordFailure(ip);
    return NextResponse.json({ error: '비밀번호가 맞지 않습니다.' }, { status: 401 });
  }
  recordSuccess(ip);
  const res = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== '1';
  res.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
  return res;
}
