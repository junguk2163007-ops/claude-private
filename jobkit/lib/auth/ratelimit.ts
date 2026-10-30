// 로그인 시도 제한 (메모리). IP 당 15분에 5번 실패하면 15분 잠금, 전체 1시간 50번 실패면 전체 잠금.

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_IP = 5;
const LOCK_MS = 15 * 60 * 1000;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const MAX_GLOBAL = 50;

interface Entry {
  failures: number[];
  lockedUntil: number;
}

const g = globalThis as unknown as { __jobkitRate?: { ips: Map<string, Entry>; global: number[] } };
function store() {
  g.__jobkitRate ??= { ips: new Map(), global: [] };
  return g.__jobkitRate;
}

export function resetRateLimit() {
  g.__jobkitRate = undefined;
}

/** 잠겨 있으면 남은 초, 아니면 0 */
export function lockedFor(ip: string, now = Date.now()): number {
  const s = store();
  s.global = s.global.filter((t) => now - t < GLOBAL_WINDOW_MS);
  if (s.global.length >= MAX_GLOBAL) return Math.ceil((s.global[0] + GLOBAL_WINDOW_MS - now) / 1000);
  const e = s.ips.get(ip);
  if (e && e.lockedUntil > now) return Math.ceil((e.lockedUntil - now) / 1000);
  return 0;
}

export function recordFailure(ip: string, now = Date.now()) {
  const s = store();
  s.global.push(now);
  const e = s.ips.get(ip) ?? { failures: [], lockedUntil: 0 };
  e.failures = e.failures.filter((t) => now - t < WINDOW_MS);
  e.failures.push(now);
  if (e.failures.length >= MAX_PER_IP) {
    e.lockedUntil = now + LOCK_MS;
    e.failures = [];
  }
  s.ips.set(ip, e);
  if (s.ips.size > 10_000) s.ips.clear();
}

export function recordSuccess(ip: string) {
  store().ips.delete(ip);
}

export function clientIp(headers: Headers): string {
  return (
    headers.get('fly-client-ip') ||
    headers.get('x-real-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    'local'
  );
}
