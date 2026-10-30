// 단일 사용자 세션: HMAC-SHA256 으로 서명한 httpOnly 쿠키.
// Web Crypto 만 사용하므로 middleware(edge)와 route handler(node) 양쪽에서 동작한다.

export const SESSION_COOKIE = 'jobkit_session';
export const SESSION_MAX_AGE = 60 * 60 * 24 * 14; // 14일

const enc = new TextEncoder();

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(s: string): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s)));
}

export function passwordConfigured(): boolean {
  return !!process.env.APP_PASSWORD && process.env.APP_PASSWORD.length > 0;
}

/** 서명 키: SESSION_SECRET + 비밀번호 해시. 비밀번호를 바꾸면 기존 세션은 자동으로 무효가 된다. */
async function key(): Promise<CryptoKey> {
  const pw = process.env.APP_PASSWORD ?? '';
  const secret = process.env.SESSION_SECRET ?? '';
  const material = await sha256(`jobkit-session:${secret}:${b64url(await sha256(pw))}`);
  return crypto.subtle.importKey('raw', material, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function sign(payload: string): Promise<string> {
  return b64url(await crypto.subtle.sign('HMAC', await key(), enc.encode(payload)));
}

export async function createSessionToken(now = Date.now()): Promise<string> {
  const exp = Math.floor(now / 1000) + SESSION_MAX_AGE;
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const payload = `v1.${exp}.${nonce}`;
  return `${payload}.${await sign(payload)}`;
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function verifySessionToken(token: string | undefined | null, now = Date.now()): Promise<boolean> {
  if (!token || !passwordConfigured()) return false;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') return false;
  const exp = Number(parts[1]);
  if (!Number.isFinite(exp) || exp * 1000 < now) return false;
  const expected = await sign(parts.slice(0, 3).join('.'));
  return constantTimeEqual(expected, parts[3]);
}

/** 비밀번호 비교 (해시 후 상수 시간 비교) */
export async function checkPassword(input: string): Promise<boolean> {
  if (!passwordConfigured()) return false;
  const a = b64url(await sha256(`pw:${input}`));
  const b = b64url(await sha256(`pw:${process.env.APP_PASSWORD}`));
  return constantTimeEqual(a, b);
}
