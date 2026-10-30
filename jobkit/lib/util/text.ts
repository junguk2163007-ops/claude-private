/** 한글 마지막 글자 받침 여부 (한글이 아니면 null) */
export function hasBatchim(word: string): boolean | null {
  const ch = word.trim().slice(-1);
  if (!ch) return null;
  const code = ch.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28 !== 0;
}

/** 와/과 선택 */
export function waGwa(word: string): string {
  return hasBatchim(word) ? '과' : '와';
}

export function compact(s: string): string {
  return s.replace(/\s+/g, '');
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 위탁사명 비교용 정규화: (주), ㈜, 주식회사, 공백 제거 */
export function normalizeCompany(s: string | null | undefined): string {
  return (s || '')
    .replace(/\(\s*주\s*\)|㈜|주식회사|\(\s*유\s*\)|유한회사/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export function normalizeSite(s: string | null | undefined): string {
  return (s || '').replace(/\s+/g, '').toLowerCase();
}

export function digitsOnly(s: string | null | undefined): string {
  return (s || '').replace(/\D/g, '');
}

/** "정민욱" → "정 민 욱" */
export function spacedName(name: string): string {
  return Array.from(name.replace(/\s+/g, '')).join(' ');
}
