// 사실 고정 원칙: 이력서/자소서의 사실 정보는 저장된 프로필과 블록에서만 가져온다.
// 공고에 따라 바뀌는 것은 정해진 변형 슬롯(S3, 직무경험 접두어, M1/M3, GAP)뿐이다.

import type { Analysis } from '../analyze';
import type { ParsedPosting } from '../parser';
import type { Blocks, Career, Profile } from '../types';
import { birthWithAge, koreanDate, period, yearMonth, yearOf } from '../util/date';
import { spacedName } from '../util/text';

export interface ComposeInput {
  profile: Profile;
  blocks: Blocks;
  parsed: ParsedPosting;
  analysis: Analysis;
  today: string;
}

/** 지원처 표기: 공고 필수 기재 문구가 있으면 글자 그대로, 없으면 "{site} {title} 지원" */
export function applyTarget(parsed: Pick<ParsedPosting, 'required_phrase' | 'site' | 'title'>): string {
  const rp = parsed.required_phrase?.trim();
  if (rp) return rp;
  return `${parsed.site.trim()} ${parsed.title.trim()} 지원`.replace(/\s+/g, ' ').trim();
}

/** 분양 경력 기간(년) */
export function salesYears(careers: Career[]): number {
  let total = 0;
  for (const c of careers) {
    if (!/분양/.test(`${c.company} ${c.duties}`)) continue;
    const s = yearOf(c.start);
    const e = yearOf(c.end);
    if (s !== null && e !== null && e >= s) total += e - s;
  }
  return total;
}

/** GAP 문장: 약속 가능한 미보유 자격의 promise_phrase 를 이어 붙인다. */
export function buildGap(blocks: Blocks, phrases: string[]): string {
  if (!phrases.length) return blocks.goal_gap_default.trim();
  // 각 문구가 "~취득", "~준비" 처럼 '하다'가 붙는 형태이므로 "하고,"로 잇는다.
  const head = phrases.slice(0, -1).map((p) => `${p}하고, `).join('');
  return `${head}${phrases[phrases.length - 1]}${blocks.goal_gap_suffix.trim()}`;
}

export interface LetterSection {
  key: 'growth' | 'strength' | 'experience' | 'motive' | 'goal';
  title: string;
  text: string;
}

export interface LetterData {
  target: string;
  name: string;
  sections: LetterSection[];
}

function s3For(blocks: Blocks, shift: ParsedPosting['shift']): string {
  if (shift === '격일') return blocks.strength_s3_gyeogil;
  if (shift === '3교대' || shift === '주야교대') return blocks.strength_s3_gyodae;
  return blocks.strength_s3_default;
}

const join = (...parts: string[]) =>
  parts
    .map((p) => p.trim())
    .filter(Boolean)
    .join(' ');

export function composeLetter({ profile, blocks, parsed, analysis }: ComposeInput): LetterData {
  const experience =
    (analysis.apt_exp_required_unmet ? blocks.experience_no_apt_prefix : '') +
    blocks.experience.trim().replace(/\{sales_years\}/g, String(salesYears(profile.careers)));

  const m3 = parsed.start_date
    ? blocks.motive_m3_start.replace(/\{start_date\}/g, koreanDate(parsed.start_date))
    : blocks.motive_m3;
  // 거리 문장(M1)은 근거리일 때만. 가깝다고 거짓으로 쓰지 않는다.
  const motive = analysis.near ? join(blocks.motive_m1, blocks.motive_m2, m3) : join(blocks.motive_m2, m3);

  const gap = buildGap(
    blocks,
    analysis.gap_qualifications.map((g) => g.promise_phrase),
  );
  const goal = join(blocks.goal_g1.replace(/\{GAP\}/g, gap), blocks.goal_g2);

  return {
    target: applyTarget(parsed),
    name: profile.name,
    sections: [
      { key: 'growth', title: '성장과정', text: blocks.growth.trim() },
      {
        key: 'strength',
        title: '성격의 장점 및 보완점',
        text: join(blocks.strength_s1, blocks.strength_s2, s3For(blocks, parsed.shift), blocks.strength_s4),
      },
      { key: 'experience', title: '직무 관련 경험', text: experience },
      { key: 'motive', title: '지원동기', text: motive },
      { key: 'goal', title: '입사 후 포부', text: goal },
    ],
  };
}

export interface ResumeData {
  target: string;
  name: string;
  birth: string;
  phone: string;
  email: string;
  address: string;
  applyField: string;
  education: { school: string; status: string; major: string; start: string; end: string }[];
  military: { branchCorps: string; rank: string; period: string; discharge: string } | null;
  licenses: { name: string; issuer: string; date: string }[];
  careers: { period: string; company: string; duties: string }[];
  intro: string[];
  date: string;
  signName: string;
}

export function composeResume({ profile, blocks, parsed, today }: ComposeInput): ResumeData {
  const m = profile.military;
  const hasMilitary = !!(m.branch || m.corps || m.rank || m.start || m.end || m.discharge);
  const title = parsed.title.trim();
  const site = parsed.site.trim();
  return {
    target: applyTarget(parsed),
    name: profile.name,
    birth: birthWithAge(profile.birth, today),
    phone: profile.phone,
    email: profile.email,
    address: profile.address,
    applyField: title && site ? `${title} (${site})` : title || site,
    education: profile.education.map((e) => ({
      school: e.school,
      status: e.status,
      major: e.major,
      start: yearMonth(e.start),
      end: yearMonth(e.end),
    })),
    military: hasMilitary
      ? {
          branchCorps: [m.branch, m.corps].filter(Boolean).join(' / '),
          rank: m.rank,
          period: period(m.start, m.end),
          discharge: m.discharge,
        }
      : null,
    licenses: profile.licenses.map((l) => ({ name: l.name, issuer: l.issuer, date: yearMonth(l.date) })),
    // 입력 순서 유지 (최신순 정렬하지 않음)
    careers: profile.careers.map((c) => ({ period: period(c.start, c.end), company: c.company, duties: c.duties })),
    intro: [blocks.resume_intro_1, blocks.resume_intro_2, blocks.resume_intro_3].map((s) => s.trim()).filter(Boolean),
    date: koreanDate(today),
    signName: spacedName(profile.name),
  };
}

export interface ProfileCheck {
  /** 필수 입력 누락 (생성 전에 경고, 막지는 않음) */
  required: string[];
  /** 선택 항목 누락 (PDF 에 "-" 로 표시됨) */
  optional: string[];
}

export function checkProfile(profile: Profile): ProfileCheck {
  const required: string[] = [];
  if (!profile.name.trim()) required.push('이름');
  if (!profile.birth.trim()) required.push('생년월일');
  if (!profile.phone.trim()) required.push('연락처');
  if (!profile.email.trim()) required.push('이메일');
  if (!profile.address.trim()) required.push('주소');
  if (!profile.photo_file) required.push('사진');
  const optional: string[] = [];
  profile.licenses.forEach((l) => {
    if (!l.issuer.trim()) optional.push(`자격 '${l.name || '(이름 없음)'}'의 발급기관`);
    if (!l.date.trim()) optional.push(`자격 '${l.name || '(이름 없음)'}'의 취득일자`);
  });
  profile.education.forEach((e) => {
    if (!e.start || !e.end) optional.push(`학력 '${e.school || '(학교명 없음)'}'의 입학/졸업연월`);
  });
  profile.careers.forEach((c) => {
    if (!c.start || !c.end) optional.push(`경력 '${c.company || '(근무처 없음)'}'의 근무기간`);
  });
  return { required, optional };
}
