// 날짜는 모두 Asia/Seoul 기준의 'YYYY-MM-DD' 문자열로 다룬다.

export function todaySeoul(now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(now); // en-CA → YYYY-MM-DD
}

export function nowSeoulIso(now: Date = new Date()): string {
  const d = todaySeoul(now);
  const t = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(now);
  return `${d} ${t}`;
}

export function isIsoDate(s: string | null | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function parts(iso: string) {
  const [y, m, d] = iso.split('-').map((v) => parseInt(v, 10));
  return { y, m, d };
}

/** 2026-10-24 → "2026년 10월 24일" */
export function koreanDate(iso: string | null | undefined): string {
  if (!isIsoDate(iso)) return '';
  const { y, m, d } = parts(iso);
  return `${y}년 ${m}월 ${d}일`;
}

/** 만 나이 */
export function manAge(birth: string, today: string): number | null {
  if (!isIsoDate(birth) || !isIsoDate(today)) return null;
  const b = parts(birth);
  const t = parts(today);
  let age = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) age -= 1;
  return age;
}

/** "1984년 4월 16일 (만 42세)" */
export function birthWithAge(birth: string, today: string): string {
  if (!isIsoDate(birth)) return '';
  const age = manAge(birth, today);
  return `${koreanDate(birth)}${age !== null ? ` (만 ${age}세)` : ''}`;
}

/** "2003-03" → "2003.03", "2010" → "2010" */
export function yearMonth(s: string | null | undefined): string {
  if (!s) return '';
  const m = s.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?$/);
  if (!m) return s;
  if (m[3]) return `${m[1]}.${m[2].padStart(2, '0')}.${m[3].padStart(2, '0')}`;
  if (m[2]) return `${m[1]}.${m[2].padStart(2, '0')}`;
  return m[1];
}

export function period(start: string, end: string): string {
  const a = yearMonth(start);
  const b = yearMonth(end);
  if (!a && !b) return '';
  return `${a || '-'} ~ ${b || '-'}`;
}

export function yearOf(s: string): number | null {
  const m = s?.match(/^(\d{4})/);
  return m ? parseInt(m[1], 10) : null;
}
