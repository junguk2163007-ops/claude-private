// 공고 원문을 줄 단위로 나누고, 각 줄의 섹션(바로 위 제목)과 라벨/값을 판별한다.

export type Category = '우대' | '필수(명시)' | '완화' | '필수로 보임';

export interface LineInfo {
  idx: number;
  raw: string;
  /** 앞쪽 글머리표/번호를 뗀 본문 */
  text: string;
  bulleted: boolean;
  isHeader: boolean;
  /** 이 줄이 속한 섹션 제목 (헤더 줄이면 자기 자신) */
  section: string | null;
  category: Category;
  /** 요건 섹션(자격요건/지원조건/우대사항 등)에 속한 줄인지 */
  inRequirementSection: boolean;
}

const BULLET_RE =
  /^(?:[-–—*•·ㆍ▪▫◦‣∙○●◎◇◆□■▣▶▷►※✔✓☞→]+|\(?\d{1,2}\)|\d{1,2}\.(?!\d)|[①-⑳]|[가-하][.)]|[a-zA-Z][.)](?=\s))\s*/;
const HEADING_MARK_RE = /^\s*(?:\[([^\]]+)\]|【([^】]+)】|<([^>]+)>|〈([^〉]+)〉|《([^》]+)》|[■□◆◇▣◈●]\s*(.+)|(?:\d{1,2}|[IVX]{1,4})\.\s*(.+))\s*:?\s*$/;

const SECTION_WORDS = [
  '모집개요',
  '모집요강',
  '채용개요',
  '근무조건',
  '근무환경',
  '근무내용',
  '담당업무',
  '업무내용',
  '자격요건',
  '지원자격',
  '지원조건',
  '자격조건',
  '응시자격',
  '필수요건',
  '필수조건',
  '필수사항',
  '우대사항',
  '우대조건',
  '우대',
  '급여',
  '처우',
  '복리후생',
  '제출서류',
  '구비서류',
  '접수방법',
  '지원방법',
  '접수방식',
  '전형',
  '기타',
  '문의',
  '담당자',
  '모집분야',
  '채용분야',
  '근무지',
  '근무시간',
  '근무형태',
  '유의사항',
  '참고사항',
];

/** 줄의 값을 요건 섹션으로 볼 라벨 */
export const REQUIREMENT_SECTION_RE = /(자격|요건|우대|지원\s*조건|응시)/;
const NOT_REQUIREMENT_SECTION_RE = /(근무\s*조건|근무\s*환경|급여|처우)/;

export function stripBullet(s: string): { text: string; bulleted: boolean } {
  const m = s.match(BULLET_RE);
  if (!m) return { text: s.trim(), bulleted: false };
  return { text: s.slice(m[0].length).trim(), bulleted: true };
}

function compactWord(s: string) {
  return s.replace(/\s+/g, '');
}

/** 섹션 제목 줄인지 판별. 맞으면 제목 텍스트를 돌려준다. */
export function headerOf(raw: string): string | null {
  const line = raw.trim();
  if (!line) return null;
  let core: string | null = null;
  const m = line.match(HEADING_MARK_RE);
  if (m) core = (m.slice(1).find(Boolean) || '').trim();
  else if (/^[^:：]{1,16}[:：]\s*$/.test(line)) core = line.replace(/[:：]\s*$/, '').trim();
  else if (SECTION_WORDS.includes(compactWord(line))) core = line;
  if (core === null) return null;
  core = core.replace(/[:：]\s*$/, '').trim();
  const c = compactWord(core);
  if (c.length === 0 || c.length > 14) return null;
  if (!SECTION_WORDS.some((w) => c.startsWith(w))) return null;
  return core;
}

export function categorize(line: string, section: string | null): Category {
  const byText = (t: string): Category | null => {
    if (/우대/.test(t)) return '우대';
    if (/[(\[]\s*필수\s*[)\]]/.test(t)) return '필수(명시)';
    if (/(초보\s*가능|초보자\s*가능|신입\s*가능|무경험\s*가능|경력\s*무관)/.test(t)) return '완화';
    return null;
  };
  const fromLine = byText(line);
  if (fromLine) return fromLine;
  if (section) {
    if (/우대/.test(section)) return '우대';
    if (/필수/.test(section)) return '필수(명시)';
    const s = byText(section);
    if (s) return s;
  }
  return '필수로 보임';
}

/** 한 줄에 " * 항목 * 항목" 처럼 여러 글머리표가 이어진 경우 나눈다. */
function splitInlineBullets(line: string): string[] {
  const re = /\s[*•]\s/g;
  const count = (line.match(re) || []).length;
  if (count < 2) return [line];
  return line
    .split(/\s(?=[*•]\s)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[  -​　]/g, ' ')
    .replace(/：/g, ':')
    .replace(/～/g, '~');
}

/** 섹션을 바꾸는(값을 가진) 라벨 줄인지 판별: "라벨<구분자>값" 이고 라벨이 알려진 라벨이면 라벨 반환 */
export type LabelMatcher = (text: string) => string | null;

export function segmentLines(text: string, labelOf: LabelMatcher): LineInfo[] {
  const rawLines = normalizeText(text).split('\n').flatMap(splitInlineBullets);
  const out: LineInfo[] = [];
  let section: string | null = null;
  let prevBlank = false;
  rawLines.forEach((raw, idx) => {
    const trimmed = raw.trim();
    if (!trimmed) {
      prevBlank = true;
      out.push({ idx, raw, text: '', bulleted: false, isHeader: false, section, category: '필수로 보임', inRequirementSection: false });
      return;
    }
    const header = headerOf(trimmed);
    const { text: body, bulleted } = stripBullet(trimmed);
    let isHeader = false;
    if (header) {
      section = header;
      isHeader = true;
    } else {
      const label = labelOf(body);
      if (label && !bulleted) section = label;
      else if (prevBlank && !bulleted) section = null; // 빈 줄 뒤의 글머리표 없는 줄은 앞 섹션에서 벗어난 것으로 본다
    }
    prevBlank = false;
    const inReq = !!section && REQUIREMENT_SECTION_RE.test(section) && !NOT_REQUIREMENT_SECTION_RE.test(section);
    out.push({
      idx,
      raw,
      text: body,
      bulleted,
      isHeader,
      section,
      category: categorize(body, isHeader ? null : section),
      inRequirementSection: inReq && !isHeader,
    });
  });
  return out;
}
