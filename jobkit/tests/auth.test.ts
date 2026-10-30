import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { checkPassword, createSessionToken, verifySessionToken, SESSION_MAX_AGE } from '@/lib/auth/session';
import { lockedFor, recordFailure, recordSuccess, resetRateLimit } from '@/lib/auth/ratelimit';

beforeEach(() => {
  process.env.APP_PASSWORD = 'correct horse battery';
  process.env.SESSION_SECRET = 'test-secret-0123456789abcdef0123456789';
  resetRateLimit();
});
afterEach(() => {
  delete process.env.APP_PASSWORD;
  delete process.env.SESSION_SECRET;
});

describe('세션 쿠키', () => {
  it('서명 검증', async () => {
    const t = await createSessionToken();
    expect(await verifySessionToken(t)).toBe(true);
    expect(await verifySessionToken(t.slice(0, -2) + 'xx')).toBe(false);
    expect(await verifySessionToken('v1.9999999999.abc.def')).toBe(false);
    expect(await verifySessionToken(undefined)).toBe(false);
  });
  it('만료', async () => {
    const t = await createSessionToken(Date.now() - (SESSION_MAX_AGE + 10) * 1000);
    expect(await verifySessionToken(t)).toBe(false);
  });
  it('비밀번호를 바꾸면 기존 세션 무효', async () => {
    const t = await createSessionToken();
    process.env.APP_PASSWORD = 'new password';
    expect(await verifySessionToken(t)).toBe(false);
  });
  it('APP_PASSWORD 가 없으면 로그인 불가', async () => {
    delete process.env.APP_PASSWORD;
    expect(await checkPassword('')).toBe(false);
  });
  it('비밀번호 확인', async () => {
    expect(await checkPassword('correct horse battery')).toBe(true);
    expect(await checkPassword('wrong')).toBe(false);
  });
});

describe('로그인 시도 제한', () => {
  it('IP 당 5번 실패하면 잠금, 다른 IP 는 영향 없음', () => {
    const now = Date.now();
    for (let i = 0; i < 4; i++) recordFailure('1.1.1.1', now);
    expect(lockedFor('1.1.1.1', now)).toBe(0);
    recordFailure('1.1.1.1', now);
    expect(lockedFor('1.1.1.1', now)).toBeGreaterThan(0);
    expect(lockedFor('2.2.2.2', now)).toBe(0);
    expect(lockedFor('1.1.1.1', now + 16 * 60 * 1000)).toBe(0);
  });
  it('성공하면 실패 기록 초기화', () => {
    for (let i = 0; i < 4; i++) recordFailure('3.3.3.3');
    recordSuccess('3.3.3.3');
    recordFailure('3.3.3.3');
    expect(lockedFor('3.3.3.3')).toBe(0);
  });
});
