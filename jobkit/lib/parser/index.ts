// 규칙 기반 공고 파서. 결과는 항상 화면의 "수정 가능한 폼"으로 보여주고 사용자가 확정한다.
// 원문에 없는 값은 만들지 않는다(추측 금지) — 못 찾으면 null/빈 값.

import type { Shift } from '../types';
import { todaySeoul } from '../util/date';
import { type Category, type LineInfo, normalizeText, segmentLines, stripBullet } from './lines';

export type { Category, LineInfo } from './lines';

export interface RequirementLine {
  line: string;
  section: string | null;
  category: Category;
}

export interface ParsedPosting {
  site: string;
  title: string;
  company: string;
  address: string;
  households: number | null;
  salary_text: string;
  salary_amount: number | null;
  shift: Shift;
  shift_text: string;
  break_time: string;
  emails: string[];
  phone: string;
  phones: string[];
  deadline: string | null;
  deadline_text: string;
  start_date: string | null;
  required_phrase: string | null;
  submit_docs: string[];
  apply_channels: string[];
  flags: { probation: string | null };
  requirements: RequirementLine[];
}

// ---------- 라벨 ----------

interface LabelSpec {
  label: string;
  /** true 이면 ":" 또는 탭 구분자만 허용 (공백 구분 금지) */
  strict?: boolean;
}

const L = (labels: (string | [string, true])[]): LabelSpec[] =>
  labels.map((l) => (Array.isArray(l) ? { label: l[0], strict: true } : { label: l }));

const SITE_LABELS = L(['단지명', '아파트명', '사업장명', '현장명', '건물명', '근무처명', '근무처', ['아파트', true], ['단지', true]]);
const TITLE_LABELS = L(['채용정보', '채용분야', '모집분야', '모집직종', '채용직종', '모집부문', '채용부문', '모집직책', '채용직책', '직책', ['직종', true], ['모집직무', true]]);
const COMPANY_LABELS = L(['위탁사명', '위탁관리회사', '위탁회사', '위탁사', '관리회사', '관리업체', '회사명', '업체명', '기업명']);
const ADDRESS_LABELS = L(['근무지주소', '단지주소', '주소', '소재지', '근무장소', ['근무지', true], ['위치', true]]);
const HOUSEHOLD_LABELS = L(['총세대수', '세대수']);
const SALARY_LABELS = L(['월급여', '급여조건', '급여', '임금', '월급', '보수', '연봉']);
const SHIFT_LABELS = L(['근무형태', '근무시간', '근무방식', '근무일시', '근무요일', ['근무조건', true]]);
const PHONE_LABELS = L(['담당자연락처', '근무처전화', '관리사무소전화', '전화번호', ['연락처', true], ['전화', true], ['문의', true], ['TEL', true], ['담당자', true]]);
const DEADLINE_LABELS = L(['마감일자', '마감일', '접수마감', '접수기간', '모집기간', '채용기간', ['마감', true]]);
const START_LABELS = L(['출근예정일', '근무시작일', '근무개시일', '입사예정일', '근무예정일', '출근일']);
const SUBMIT_LABELS = L(['제출서류', '구비서류', ['서류', true]]);
const APPLY_LABELS = L(['접수방법', '지원방법', '접수방식', '지원방식']);
const SECTION_LABELS = L(['지원조건', '자격요건', '지원자격', '자격조건', '우대사항', '우대조건', '응시자격', '필수요건', '필수사항']);

const ALL_LABELS = [
  SITE_LABELS,
  TITLE_LABELS,
  COMPANY_LABELS,
  ADDRESS_LABELS,
  HOUSEHOLD_LABELS,
  SALARY_LABELS,
  SHIFT_LABELS,
  PHONE_LABELS,
  DEADLINE_LABELS,
  START_LABELS,
  SUBMIT_LABELS,
  APPLY_LABELS,
  SECTION_LABELS,
  L(['이메일', 'E-MAIL', '휴게시간']),
].flat();

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const labelReCache = new Map<string, RegExp>();
function labelRe(spec: LabelSpec): RegExp {
  const key = `${spec.label}|${spec.strict ? 1 : 0}`;
  let re = labelReCache.get(key);
  if (!re) {
    const pat = Array.from(spec.label).map(escapeRe).join('\\s*');
    const sep = spec.strict ? '(?:\\s*[:|]\\s*|\\t+\\s*)' : '(?:\\s*[:|]\\s*|\\t+\\s*|\\s+)';
    re = new RegExp(`^${pat}(?:${sep}(.*)|\\s*[:|]?\\s*$)`, 'i');
    labelReCache.set(key, re);
  }
  return re;
}

/** 줄 본문이 라벨로 시작하면 {label, value} */
function matchLabel(text: string, specs: LabelSpec[]): { label: string; value: string } | null {
  for (const s of specs) {
    const m = text.match(labelRe(s));
    if (m) return { label: s.label, value: (m[1] || '').trim() };
  }
  return null;
}

const SORTED_ALL = [...ALL_LABELS].sort((a, b) => b.label.length - a.label.length);
export function labelOf(text: string): string | null {
  const m = matchLabel(text, SORTED_ALL);
  if (!m) return null;
  return m.label;
}

/** 라벨 값 찾기. 값이 비어 있으면 다음 줄(라벨이 아닌)을 값으로 본다. */
function findLabeled(lines: LineInfo[], specs: LabelSpec[], accept: (v: string) => boolean = () => true): string | null {
  const sorted = [...specs].sort((a, b) => b.label.length - a.label.length);
  for (let i = 0; i < lines.length; i++) {
    const li = lines[i];
    if (!li.text || li.isHeader) continue;
    const m = matchLabel(li.text, sorted);
    if (!m) continue;
    let value = m.value;
    if (!value) {
      const next = lines.slice(i + 1).find((l) => l.text);
      if (next && !labelOf(next.text) && !next.isHeader) value = next.text;
    }
    if (value && accept(value)) return value;
  }
  return null;
}

// ---------- 정리 함수 ----------

const DECOR_RE = /[★☆◀▶◁▷►◄【】\[\]「」『』<>《》〈〉♠♣♥♡◆◇■□●○◎※✔✓✅❗!~♬♪]+/g;
const ROLE_WORDS = '주임|기사|과장|소장|반장|대리|팀장|경리|직원|관리원|경비원|미화원|기전|기술자';

export function cleanTitle(v: string): string {
  let t = v.replace(DECOR_RE, ' ').replace(/\s+/g, ' ').trim();
  t = t.replace(/\s*(구인|채용|모집|구함|급구)\s*(합니다|중|공고)?\s*$/, '').trim();
  t = t.replace(/^(구인|채용|모집)\s+/, '').trim();
  // "시설 주임" → "시설주임"
  const m = t.match(new RegExp(`^([가-힣]{1,4})\\s+(${ROLE_WORDS})(\\(.*\\))?$`));
  if (m) t = `${m[1]}${m[2]}${m[3] ?? ''}`;
  return t;
}

function cleanValue(v: string | null): string {
  return (v || '').replace(DECOR_RE, ' ').replace(/\s+/g, ' ').trim();
}

export function parseSalaryAmount(s: string): number | null {
  const won = s.match(/(\d{1,3}(?:,\d{3})+|\d{4,})\s*원/);
  if (won) return parseInt(won[1].replace(/,/g, ''), 10);
  const man = s.match(/(\d{1,4}(?:[.,]\d+)?)\s*만\s*원?/);
  if (man) return Math.round(parseFloat(man[1].replace(/,/g, '')) * 10000);
  return null;
}

export function classifyShift(s: string): Shift | null {
  if (/격일|24\s*시간\s*맞?교대|맞교대/.test(s)) return '격일';
  if (/3\s*교대|삼교대|주\s*당\s*비|주당비/.test(s)) return '3교대';
  if (/주\s*[·\/]?\s*야\s*간?\s*교대|주\s*\/\s*야|2\s*교대/.test(s)) return '주야교대';
  if (/평일|월\s*[~\-]\s*금|주\s*5\s*일|상근|일근|주간\s*근무|0?9\s*:\s*00\s*~\s*1[78]\s*:\s*00/.test(s)) return '상근';
  return null;
}

/** 여러 날짜 표기를 ISO 로. 연도가 없으면 기준 연도 사용. */
export function parseDates(s: string, refYear: number): string[] {
  const out: string[] = [];
  const re = /(\d{4})\s*(?:[-./]|년)\s*(\d{1,2})\s*(?:[-./]|월)\s*(\d{1,2})\s*일?|(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const y = m[1] ? parseInt(m[1], 10) : refYear;
    const mo = parseInt(m[2] ?? m[4], 10);
    const d = parseInt(m[3] ?? m[5], 10);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) out.push(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return out;
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const PHONE_RE = /(?<!\d)(?:0\d{1,2}|1[5-9]\d{2})[-.)\s]?\d{3,4}[-.\s]?\d{4}(?!\d)/g;

function normalizePhone(p: string): string {
  const d = p.replace(/\D/g, '');
  if (/^02\d{7,8}$/.test(d)) return d.length === 9 ? `02-${d.slice(2, 5)}-${d.slice(5)}` : `02-${d.slice(2, 6)}-${d.slice(6)}`;
  if (/^0\d{9,10}$/.test(d)) return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (/^1\d{7}$/.test(d)) return `${d.slice(0, 4)}-${d.slice(4)}`;
  return p.trim();
}

const QUOTE_RES = [/“\s*([^”\n]{2,80}?)\s*”/, /"\s*([^"\n]{2,80}?)\s*"/, /‘\s*([^’\n]{2,80}?)\s*’/, /'\s*([^'\n]{2,80}?)\s*'/, /「\s*([^」\n]{2,80}?)\s*」/, /『\s*([^』\n]{2,80}?)\s*』/];
const PLACEHOLDER_RE = /(지원\s*분야|지원\s*직종|성명|이름|단지명|지원자명|○○|OO|xx|XX|\{|\})/;

export function extractRequiredPhrase(lines: LineInfo[]): string | null {
  const isTrigger = (t: string) => /(기재|표기|명시|적어)/.test(t) || (/필수/.test(t) && /(제목|상단)/.test(t));
  const texts = lines.map((l) => l.raw.trim());
  // 1) 따옴표로 감싼 문구 우선 (같은 줄 → 다음 줄 → 이전 줄)
  for (let i = 0; i < texts.length; i++) {
    if (!isTrigger(texts[i])) continue;
    for (const j of [i, i + 1, i - 1]) {
      const t = texts[j];
      if (!t) continue;
      for (const re of QUOTE_RES) {
        const m = t.match(re);
        if (m && !PLACEHOLDER_RE.test(m[1])) return m[1].trim();
      }
    }
  }
  // 2) 따옴표가 없으면 "상단에 XXX 필수 표기" 형태에서만 추출 (추측 금지)
  for (const t of texts) {
    if (!isTrigger(t)) continue;
    const m = t.match(/(?:상단|제목|상단부)\s*(?:에는|에)\s*(.+?)\s*(?:을|를)?\s*(?:꼭|반드시|필히)?\s*(?:필수\s*)?(?:로\s*)?(?:기재|표기)/);
    if (!m) continue;
    const c = m[1].replace(/^(?:꼭|반드시|필히)\s*/, '').trim();
    if (c.length >= 2 && c.length <= 60 && !PLACEHOLDER_RE.test(c) && !/(이력서|메일|제목|상단)/.test(c)) return c;
  }
  return null;
}

const DOC_KEYWORDS: [string, RegExp][] = [
  ['이력서', /이력서/],
  ['자기소개서', /자기소개서|자소서/],
  ['자격증 사본', /자격증\s*(?:사본|복사본)|자격수첩/],
  ['경력증명서', /경력\s*증명서/],
  ['주민등록등본', /주민등록\s*등본|등본/],
  ['주민등록초본', /초본/],
  ['통장 사본', /통장\s*(?:사본)?/],
  ['개인정보동의서', /개인정보[^,\n]{0,12}동의서/],
  ['졸업증명서', /졸업\s*증명서/],
  ['건강진단서', /건강\s*진단서|보건증|채용\s*신체검사/],
  ['가족관계증명서', /가족관계/],
  ['신분증 사본', /신분증/],
  ['운전경력증명서', /운전\s*경력/],
];

function extractSubmitDocs(lines: LineInfo[], fullText: string): string[] {
  const parts: string[] = [];
  lines.forEach((l) => {
    if (!l.text) return;
    if (l.section && /서류/.test(l.section)) parts.push(l.text);
    else if (matchLabel(l.text, SUBMIT_LABELS)) parts.push(l.text);
  });
  const scope = parts.length ? parts.join('\n') : fullText;
  const found = DOC_KEYWORDS.filter(([, re]) => re.test(scope)).map(([n]) => n);
  // 등본·통장 사본은 안전 경고용이므로 원문 전체에서도 확인한다
  for (const n of ['주민등록등본', '통장 사본']) {
    const re = DOC_KEYWORDS.find(([k]) => k === n)![1];
    if (!found.includes(n) && re.test(fullText)) found.push(n);
  }
  return found;
}

function extractChannels(text: string, emails: string[]): string[] {
  const out: string[] = [];
  if (emails.length || /(이메일|e-?mail|메일)\s*(접수|지원|제출)/i.test(text)) out.push('email');
  if (/고용\s*24|워크넷|work\s*24/i.test(text)) out.push('고용24');
  if (/잡코리아/.test(text)) out.push('잡코리아');
  if (/사람인/.test(text)) out.push('사람인');
  if (/방문\s*(?:접수|제출)|직접\s*방문|내방/.test(text)) out.push('방문');
  if (/우편|등기/.test(text)) out.push('우편');
  if (/팩스|fax/i.test(text)) out.push('팩스');
  return out;
}

function fallbackFromTitleLine(lines: LineInfo[]): { site: string; title: string } {
  const first = lines.find((l) => l.text)?.raw.trim() ?? '';
  const stripped = first.replace(/\[[^\]]*\]|【[^】]*】|\([^)]*\)|㈜/g, ' ').replace(DECOR_RE, ' ').replace(/\s+/g, ' ').trim();
  const tokens = stripped.split(' ');
  const roleIdx = tokens.findIndex((t) => new RegExp(`(${ROLE_WORDS}|시설|관리|구인|채용|모집)`).test(t));
  const site = roleIdx > 0 ? tokens.slice(0, roleIdx).join(' ') : '';
  const titleTokens = roleIdx >= 0 ? tokens.slice(roleIdx) : [];
  const title = cleanTitle(titleTokens.join(' '));
  return { site, title: new RegExp(`(${ROLE_WORDS})`).test(title) ? title : '' };
}

// ---------- 메인 ----------

/** 요건 줄 표시용: "지원조건\t1) 아파트 경력자 우대" → "아파트 경력자 우대" */
export function itemText(l: LineInfo): string {
  const m = matchLabel(l.text, SECTION_LABELS);
  return stripBullet(m && m.value ? m.value : l.text).text;
}

export function scanLines(text: string): LineInfo[] {
  return segmentLines(text, labelOf);
}

export function parsePosting(text: string, today: string = todaySeoul()): ParsedPosting {
  const norm = normalizeText(text);
  const lines = scanLines(norm);
  const refYear = parseInt(today.slice(0, 4), 10);

  const fb = fallbackFromTitleLine(lines);
  const site = cleanValue(findLabeled(lines, SITE_LABELS)) || fb.site;
  const titleRaw = findLabeled(lines, TITLE_LABELS);
  const title = (titleRaw && cleanTitle(titleRaw)) || fb.title;
  const company = cleanValue(findLabeled(lines, COMPANY_LABELS));
  const address = cleanValue(findLabeled(lines, ADDRESS_LABELS, (v) => /[가-힣]/.test(v)));
  const hh = findLabeled(lines, HOUSEHOLD_LABELS, (v) => /\d/.test(v));
  const households = hh ? parseInt(hh.replace(/[^\d]/g, ''), 10) || null : null;

  const salary_text = cleanValue(findLabeled(lines, SALARY_LABELS, (v) => /\d|협의|내규|면접/.test(v)));
  const salary_amount = salary_text ? parseSalaryAmount(salary_text) : null;

  // 근무형태: 라벨 값 우선, 없으면 원문 전체
  const shiftValues: string[] = [];
  const shiftSorted = [...SHIFT_LABELS].sort((a, b) => b.label.length - a.label.length);
  for (const l of lines) {
    if (!l.text || l.isHeader) continue;
    const m = matchLabel(l.text, shiftSorted);
    if (m && m.value) shiftValues.push(m.value);
  }
  const shiftText = shiftValues.join(' / ');
  const shift: Shift = classifyShift(shiftText) ?? classifyShift(norm) ?? '기타';
  const breakM = norm.match(/휴게\s*(?:시간)?\s*[:|]?\s*([^\n]+)/);
  const break_time = breakM ? cleanValue(breakM[1]) : '';

  const emails = Array.from(new Set((norm.match(EMAIL_RE) || []).map((e) => e.toLowerCase())));
  const allPhones = Array.from(new Set((norm.match(PHONE_RE) || []).map(normalizePhone)));
  const phoneOne = new RegExp(PHONE_RE.source);
  const lp = findLabeled(lines, PHONE_LABELS, (v) => phoneOne.test(v))?.match(phoneOne)?.[0];
  const phone = lp ? normalizePhone(lp) : allPhones[0] ?? '';
  const phones = lp ? Array.from(new Set([normalizePhone(lp), ...allPhones])) : allPhones;

  // 마감일
  const deadlineRaw = findLabeled(lines, DEADLINE_LABELS) ?? '';
  let deadline: string | null = null;
  if (deadlineRaw && !/채용\s*시\s*까지|채용시|상시|충원\s*시|마감\s*시/.test(deadlineRaw)) {
    const ds = parseDates(deadlineRaw, refYear);
    deadline = ds.length ? ds[ds.length - 1] : null;
  }

  // 출근예정일
  let start_date: string | null = null;
  const startRaw = findLabeled(lines, START_LABELS, (v) => parseDates(v, refYear).length > 0);
  if (startRaw) start_date = parseDates(startRaw, refYear)[0];
  else {
    const m = norm.match(/(?:출근|근무\s*시작|근무\s*개시|입사)\s*(?:예정)?\s*일?\s*[:|]?\s*([^\n]{0,30})/);
    if (m) start_date = parseDates(m[1], refYear)[0] ?? null;
  }

  const probLine = lines.find((l) => /(\d+\s*개월)[^\n]{0,25}(평가|계약\s*연장|정규직)|수습\s*(기간)?|시용\s*기간/.test(l.text));

  const requirements: RequirementLine[] = lines
    .filter((l) => l.inRequirementSection && l.text)
    .map((l) => ({ line: itemText(l), section: l.section, category: l.category }));

  return {
    site,
    title,
    company,
    address,
    households,
    salary_text,
    salary_amount,
    shift,
    shift_text: shiftText,
    break_time,
    emails,
    phone,
    phones,
    deadline,
    deadline_text: cleanValue(deadlineRaw),
    start_date,
    required_phrase: extractRequiredPhrase(lines),
    submit_docs: extractSubmitDocs(lines, norm),
    apply_channels: extractChannels(norm, emails),
    flags: { probation: probLine ? stripBullet(probLine.text).text : null },
    requirements,
  };
}
