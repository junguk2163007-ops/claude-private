// 분석은 정보 제공용이다. 결과와 무관하게 서류 생성은 항상 가능해야 한다.

import { type Category, type LineInfo, type ParsedPosting, itemText, scanLines } from '../parser';
import type { ApplicationStatus, Barrier, Qualification, Settings } from '../types';
import { koreanDate, todaySeoul } from '../util/date';
import { compact, normalizeCompany, normalizeSite } from '../util/text';

export type Verdict = '충족' | '미충족-보완가능' | '미충족-장벽' | '직접 확인';

export interface ReqRow {
  line: string;
  section: string | null;
  category: Category;
  qualification_id: number | null;
  qualification_name: string | null;
  matched_alias: string | null;
  verdict: Verdict;
  barrier: Barrier | null;
  hint: string;
}

export interface Warning {
  kind: 'docs' | 'deadline' | 'start_date' | 'shift' | 'probation' | 'history' | 'duplicate' | 'distance';
  level: 'info' | 'warn' | 'danger';
  text: string;
}

export interface HistoryEntry {
  id: number;
  created_at: string;
  site: string;
  company: string;
  emails: string[];
  status: ApplicationStatus;
}

export interface AnalyzeContext {
  qualifications: Qualification[];
  settings: Settings;
  history?: HistoryEntry[];
  today?: string;
  currentApplicationId?: number | null;
}

export type SignalLevel = 'green' | 'yellow' | 'red';

export interface QualHit {
  qualification: Qualification;
  category: Category;
}

export interface Analysis {
  rows: ReqRow[];
  hits: QualHit[];
  signal: { level: SignalLevel; title: string; detail: string };
  warnings: Warning[];
  near: boolean;
  gap_qualifications: { id: number; name: string; promise_phrase: string }[];
  apt_exp_required_unmet: boolean;
  history_matches: HistoryEntry[];
}

const CATEGORY_RANK: Record<Category, number> = { '필수(명시)': 4, '필수로 보임': 3, 우대: 2, 완화: 1 };
const REQUIRED: Category[] = ['필수(명시)', '필수로 보임'];

export function verdictOf(q: Qualification): Verdict {
  if (q.have) return '충족';
  if (q.barrier === 'low' || q.barrier === 'none') return '미충족-보완가능';
  return '미충족-장벽';
}

export function isNear(address: string | null | undefined, keywords: string[]): boolean {
  const a = (address || '').trim();
  if (!a) return false;
  return keywords.some((k) => k.trim() && a.includes(k.trim()));
}

interface Span {
  start: number;
  end: number;
  q: Qualification;
  alias: string;
}

/** 한 줄에서 별칭 매칭. 공백 무시, 겹치면 긴 별칭 우선. */
export function matchLine(text: string, qualifications: Qualification[]): { q: Qualification; alias: string }[] {
  const c = compact(text);
  const spans: Span[] = [];
  for (const q of qualifications) {
    const aliases = Array.from(new Set([q.name, ...q.aliases].map((a) => a.trim()).filter(Boolean)));
    for (const alias of aliases) {
      const ca = compact(alias);
      if (ca.length < 2) continue;
      let from = 0;
      let at: number;
      while ((at = c.indexOf(ca, from)) !== -1) {
        spans.push({ start: at, end: at + ca.length, q, alias });
        from = at + 1;
      }
    }
  }
  spans.sort((a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start);
  const chosen: Span[] = [];
  for (const s of spans) {
    if (chosen.some((o) => s.start < o.end && o.start < s.end)) continue;
    chosen.push(s);
  }
  chosen.sort((a, b) => a.start - b.start);
  const seen = new Set<number>();
  const out: { q: Qualification; alias: string }[] = [];
  for (const s of chosen) {
    if (seen.has(s.q.id)) continue;
    seen.add(s.q.id);
    out.push({ q: s.q, alias: s.alias });
  }
  return out;
}

const SKIP_UNMATCHED_RE = /(기재|표기|@|https?:|제출|접수|문의)/;

export function buildRows(lines: LineInfo[], qualifications: Qualification[]): ReqRow[] {
  const rows: ReqRow[] = [];
  for (const l of lines) {
    if (!l.text || l.isHeader) continue;
    const matches = matchLine(l.text, qualifications);
    const line = itemText(l);
    if (matches.length) {
      for (const { q, alias } of matches) {
        rows.push({
          line,
          section: l.section,
          category: l.category,
          qualification_id: q.id,
          qualification_name: q.name,
          matched_alias: alias,
          verdict: verdictOf(q),
          barrier: q.barrier,
          hint: q.hint,
        });
      }
    } else if (l.inRequirementSection && /[가-힣]{2,}/.test(line) && !SKIP_UNMATCHED_RE.test(line)) {
      rows.push({
        line,
        section: l.section,
        category: l.category,
        qualification_id: null,
        qualification_name: null,
        matched_alias: null,
        verdict: '직접 확인',
        barrier: null,
        hint: '',
      });
    }
  }
  return rows;
}

function aggregateHits(rows: ReqRow[], qualifications: Qualification[]): QualHit[] {
  const map = new Map<number, QualHit>();
  for (const r of rows) {
    if (r.qualification_id == null) continue;
    const q = qualifications.find((x) => x.id === r.qualification_id)!;
    const prev = map.get(q.id);
    if (!prev || CATEGORY_RANK[r.category] > CATEGORY_RANK[prev.category]) map.set(q.id, { qualification: q, category: r.category });
  }
  return Array.from(map.values());
}

function isAptExp(q: Qualification): boolean {
  return q.key === 'apt_exp' || (!q.key && /아파트/.test(q.name));
}

function signalOf(hits: QualHit[]): Analysis['signal'] {
  const unmetRequired = hits.filter((h) => REQUIRED.includes(h.category) && !h.qualification.have);
  const barrier = unmetRequired.filter((h) => verdictOf(h.qualification) === '미충족-장벽');
  const fixable = unmetRequired.filter((h) => verdictOf(h.qualification) === '미충족-보완가능');
  const names = (hs: QualHit[]) => hs.map((h) => h.qualification.name).join(', ');
  if (barrier.length)
    return {
      level: 'red',
      title: '서류 통과 예상 난이도: 높음',
      detail: `단기간에 보완하기 어려운 필수 요건이 미충족입니다: ${names(barrier)}${fixable.length ? ` / 보완 가능: ${names(fixable)}` : ''}`,
    };
  if (fixable.length)
    return { level: 'yellow', title: '서류 통과 예상 난이도: 보통', detail: `보완 가능한 필수 요건이 미충족입니다: ${names(fixable)}` };
  return { level: 'green', title: '서류 통과 예상 난이도: 낮음', detail: '필수로 보이는 요건 중 미충족 항목이 없습니다.' };
}

export function analyze(text: string, parsed: ParsedPosting, ctx: AnalyzeContext): Analysis {
  const today = ctx.today ?? todaySeoul();
  const lines = scanLines(text);
  const rows = buildRows(lines, ctx.qualifications);
  const hits = aggregateHits(rows, ctx.qualifications);
  const near = isNear(parsed.address, ctx.settings.near_keywords);

  const gap = hits
    .filter((h) => !h.qualification.have && h.qualification.promisable && h.qualification.promise_phrase.trim() && h.category !== '완화')
    .sort((a, b) => CATEGORY_RANK[b.category] - CATEGORY_RANK[a.category]) // 안정 정렬: 같은 등급은 공고 순서
    .map((h) => ({ id: h.qualification.id, name: h.qualification.name, promise_phrase: h.qualification.promise_phrase.trim() }));

  const apt_exp_required_unmet = hits.some((h) => isAptExp(h.qualification) && REQUIRED.includes(h.category) && !h.qualification.have);

  const warnings: Warning[] = [];
  const hasRrn = parsed.submit_docs.includes('주민등록등본');
  const hasBank = parsed.submit_docs.includes('통장 사본');
  if (hasRrn || hasBank) {
    const what = [hasRrn && '주민등록등본', hasBank && '통장 사본'].filter(Boolean).join('·');
    warnings.push({
      kind: 'docs',
      level: 'warn',
      text: `제출서류에 ${what}이(가) 있습니다. 등본은 주민번호 뒷자리 가림으로 발급하고, 통장 사본은 계좌번호 일부를 가리세요. 가능하면 합격 후 제출해도 되는지 문의하세요.`,
    });
  }
  if (parsed.deadline && parsed.deadline < today)
    warnings.push({ kind: 'deadline', level: 'danger', text: `마감일이 지났습니다 (${koreanDate(parsed.deadline)}).` });
  if (parsed.start_date && parsed.start_date < today)
    warnings.push({
      kind: 'start_date',
      level: 'warn',
      text: `출근 예정일이 지났습니다 (${koreanDate(parsed.start_date)}). 아직 채용 중인지, 일정이 바뀌었는지 확인하세요.`,
    });
  if (parsed.shift === '격일')
    warnings.push({ kind: 'shift', level: 'info', text: '24시간 격일 근무입니다. 휴일 개념이 희박하고, 당직 후 귀가 운전에 주의하세요.' });
  if (parsed.flags.probation) warnings.push({ kind: 'probation', level: 'info', text: `수습/평가 조건이 있습니다: "${parsed.flags.probation}"` });

  // 지원 이력 대조 (작성중 제외, 현재 건 제외)
  const history = (ctx.history ?? []).filter((h) => h.status !== '작성중' && h.id !== ctx.currentApplicationId);
  const comp = normalizeCompany(parsed.company);
  const emailSet = new Set(parsed.emails.map((e) => e.toLowerCase()));
  const matches = history.filter(
    (h) => (comp && normalizeCompany(h.company) === comp) || h.emails.some((e) => emailSet.has(e.toLowerCase())),
  );
  const siteKey = normalizeSite(parsed.site);
  const dup = siteKey ? history.filter((h) => normalizeSite(h.site) === siteKey) : [];
  if (dup.length)
    warnings.push({
      kind: 'duplicate',
      level: 'danger',
      text: `중복 지원: 같은 단지(${parsed.site})에 이미 지원한 이력이 있습니다 — ${dup.map((h) => `${h.created_at.slice(0, 10)} ${h.status}`).join(', ')}`,
    });
  if (matches.length)
    warnings.push({
      kind: 'history',
      level: 'info',
      text: `같은 위탁사 또는 이메일로 ${matches.length}번 지원함 (${matches.map((h) => `${h.created_at.slice(0, 10)} ${h.site}`).join(', ')})`,
    });

  if (!near)
    warnings.push({
      kind: 'distance',
      level: 'warn',
      text: parsed.address?.trim()
        ? '통근 거리 직접 확인 필요 (근거리 지역 목록에 없는 주소입니다).'
        : '주소가 없어 통근 거리를 판단할 수 없습니다. 통근 거리 직접 확인 필요.',
    });

  return {
    rows,
    hits,
    signal: signalOf(hits),
    warnings,
    near,
    gap_qualifications: gap,
    apt_exp_required_unmet,
    history_matches: matches,
  };
}

export function naverMapUrl(address: string): string {
  return `https://map.naver.com/p/search/${encodeURIComponent(address)}`;
}
