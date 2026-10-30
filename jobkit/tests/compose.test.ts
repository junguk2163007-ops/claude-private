import { beforeEach, describe, expect, it } from 'vitest';
import { analyze } from '@/lib/analyze';
import { parsePosting } from '@/lib/parser';
import { getBlocks, getProfile, getSettings, listQualifications, setQualificationHave } from '@/lib/db/repo';
import { applyTarget, buildGap, composeLetter, composeResume, salesYears, checkProfile } from '@/lib/render/compose';
import { mailBody, mailSubject, gmailComposeUrl, mailtoUrl, isPortalOnly } from '@/lib/mail';
import { fixture, freshDataDir, TODAY } from './helpers';

function compose(file: string) {
  const text = fixture(file);
  const parsed = parsePosting(text, TODAY);
  const analysis = analyze(text, parsed, { qualifications: listQualifications(), settings: getSettings(), today: TODAY });
  const input = { profile: getProfile(), blocks: getBlocks(), parsed, analysis, today: TODAY };
  const letter = composeLetter(input);
  const sec = (k: string) => letter.sections.find((s) => s.key === k)!.text;
  return { parsed, analysis, letter, sec, resume: composeResume(input) };
}

beforeEach(() => {
  freshDataDir();
});

const FIRE = '소방안전관리보조자 자격을 빠른 시일 내에 취득';
const ENERGY = '에너지관리기사 취득을 목표로 준비';
const M1 = '현재 거주지인 대구 북구와 가까운 지역이라';

describe('자기소개서 변형 슬롯', () => {
  it('F1: 격일 S3, M1 포함, GAP=소방, 아파트 접두어 없음', () => {
    const { sec, letter } = compose('F1_donam3.txt');
    expect(letter.target).toBe('힐스테이트데시앙 도남3단지 시설주임 지원');
    expect(sec('strength')).toContain('격일 근무처럼');
    expect(sec('motive')).toContain(M1);
    expect(sec('goal')).toContain(`${FIRE}하여 업무 전문성을 넓혀가겠습니다.`);
    expect(sec('experience').startsWith('건설현장에서')).toBe(true);
    expect(sec('experience')).toContain('부동산 분양 업무를 5년간');
    expect(sec('motive')).toContain('채용이 확정되는 대로');
  });

  it('F2: 아파트 접두어, 출근예정일 M3, 포부에 소방만 (기계설비 언급 금지)', () => {
    const { sec, letter } = compose('F2_donam2.txt');
    expect(letter.target).toBe('동우/힐스테이트데시앙도남2단지 시설주임 지원');
    expect(sec('experience').startsWith('아파트 시설관리 실무 경력은 없지만, 건설현장에서')).toBe(true);
    expect(sec('motive')).toContain('안내해 주신 출근 예정일(2026년 10월 1일)에 맞춰 근무를 시작할 수 있습니다.');
    expect(sec('goal')).toContain(FIRE);
    const all = letter.sections.map((s) => s.text).join('\n');
    expect(all).not.toContain('기계설비');
    expect(all).not.toContain('에너지관리기사');
  });

  it('F3: 상근 S3(격일/교대 문구 없음), GAP=에너지+소방', () => {
    const { sec } = compose('F3_chilgok.txt');
    expect(sec('strength')).toContain('체력과 생활력을 길렀습니다.');
    expect(sec('strength')).not.toMatch(/격일|교대/);
    expect(sec('goal')).toContain(`${ENERGY}하고, ${FIRE}하여 업무 전문성을 넓혀가겠습니다.`);
    expect(sec('motive')).not.toContain(M1); // 주소 없음 → 근거리 판단 불가 → 거리 문장 금지
  });

  it('F4: 근거리 아님 → M1 없음', () => {
    const { sec, letter } = compose('F4_suseong.txt');
    expect(letter.target).toBe('수성알파시티청아람 / 관리주임 지원');
    expect(sec('motive')).not.toContain(M1);
    expect(sec('motive').startsWith('시설 관리 분야는')).toBe(true);
    expect(sec('strength')).toContain('격일 근무처럼');
  });

  it('교대 근무는 "교대 및 당직 근무처럼"', () => {
    const text = '단지명 : 테스트아파트\n채용정보 : 기전주임\n근무형태 : 3교대 근무\n주소 : 대구 북구 테스트로 1';
    const parsed = parsePosting(text, TODAY);
    const analysis = analyze(text, parsed, { qualifications: listQualifications(), settings: getSettings(), today: TODAY });
    const letter = composeLetter({ profile: getProfile(), blocks: getBlocks(), parsed, analysis, today: TODAY });
    expect(letter.sections[1].text).toContain('교대 및 당직 근무처럼');
    expect(letter.sections[4].text).toContain('업무에 필요한 관련 자격을 하나씩 취득해 업무 범위를 넓혀가겠습니다.');
  });
});

describe('보유 여부(have) 토글 → F2 판정·포부 즉시 변경', () => {
  it('소방 보조를 보유로 바꾸면 GAP 기본 문구, 판정 충족', () => {
    const before = compose('F2_donam2.txt');
    expect(before.analysis.rows.find((r) => r.qualification_name === '소방안전관리자 보조')!.verdict).toBe('미충족-보완가능');
    const fire = listQualifications().find((q) => q.name === '소방안전관리자 보조')!;
    setQualificationHave(fire.id, true);
    const after = compose('F2_donam2.txt');
    expect(after.analysis.rows.find((r) => r.qualification_name === '소방안전관리자 보조')!.verdict).toBe('충족');
    expect(after.sec('goal')).not.toContain(FIRE);
    expect(after.sec('goal')).toContain('업무에 필요한 관련 자격을 하나씩 취득해');
    expect(after.analysis.signal.level).toBe('red'); // 기계설비유지관리자는 여전히 장벽
  });

  it('아파트 경력을 보유로 바꾸면 접두어가 사라진다', () => {
    const apt = listQualifications().find((q) => q.key === 'apt_exp')!;
    setQualificationHave(apt.id, true);
    const { sec, analysis } = compose('F2_donam2.txt');
    expect(sec('experience').startsWith('건설현장에서')).toBe(true);
    expect(analysis.rows.find((r) => r.qualification_name === '아파트 근무 경력')!.verdict).toBe('충족');
  });
});

describe('이력서 데이터', () => {
  it('인적사항·순서·서명', () => {
    const { resume } = compose('F1_donam3.txt');
    const p = getProfile();
    expect(resume.birth).toBe('1984년 4월 16일 (만 42세)');
    expect(resume.applyField).toBe('시설주임 (힐스테이트데시앙 도남3단지)');
    expect(resume.careers.map((c) => c.period)).toEqual(['2010 ~ 2015', '2016 ~ 2018', '2020 ~ 2022']);
    expect(resume.military).toEqual({ branchCorps: '육군 / 수색대', rank: '병장', period: '2004.02 ~ 2006.02', discharge: '만기제대' });
    expect(resume.date).toBe('2026년 10월 24일');
    expect(resume.signName).toBe(Array.from(p.name).join(' '));
    expect(resume.licenses[0]).toEqual({ name: '공인중개사', issuer: '', date: '2023' });
  });
  it('분양 경력 연수', () => {
    expect(salesYears(getProfile().careers)).toBe(5);
  });
  it('지원처 표기 기본값', () => {
    expect(applyTarget({ required_phrase: null, site: '테스트단지', title: '관리주임' })).toBe('테스트단지 관리주임 지원');
  });
  it('필수 입력 검사 (사진 없음, 발급기관 비어 있음)', () => {
    const c = checkProfile(getProfile());
    expect(c.required).toEqual(['사진']);
    expect(c.optional.join()).toContain('공인중개사');
  });
  it('GAP 문장 조합', () => {
    const b = getBlocks();
    expect(buildGap(b, [])).toBe('업무에 필요한 관련 자격을 하나씩 취득해 업무 범위를 넓혀가겠습니다');
    expect(buildGap(b, ['A 취득', 'B 준비'])).toBe('A 취득하고, B 준비하여 업무 전문성을 넓혀가겠습니다');
  });
});

describe('지원 메일', () => {
  it('F1: 필수 문구 제목', () => {
    const { parsed } = compose('F1_donam3.txt');
    const name = getProfile().name;
    expect(mailSubject(parsed, name)).toBe(`힐스테이트데시앙 도남3단지 시설주임 지원 - ${name}`);
  });
  it('F2: 기본 제목, START 문구, DOCS 문구', () => {
    const { parsed } = compose('F2_donam2.txt');
    const profile = getProfile();
    expect(mailSubject(parsed, profile.name)).toBe(`[동우/힐스테이트데시앙도남2단지] 시설주임 지원 - ${profile.name}`);
    const body = mailBody({ template: getBlocks().mail_body, parsed, profile, settings: getSettings(), extraDocs: ['자격증 사본', '주민등록등본'] });
    expect(body).toContain('동우/힐스테이트데시앙도남2단지 시설주임 채용에 지원하고자 메일 드립니다.');
    expect(body).toContain('즉시 출근이 가능합니다. 안내해 주신 출근예정일(2026년 10월 1일)에도 맞춰 근무를 시작할 수 있습니다.');
    expect(body).toContain('참고 부탁드립니다. 요청하신 자격증 사본, 주민등록등본도 함께 첨부하였습니다.');
    expect(body.trim().endsWith(`${profile.name} 드림\n${profile.phone}`)).toBe(true);
    expect(body).not.toMatch(/\{[A-Za-z_]+\}/);
  });
  it('F1: START/DOCS 없음', () => {
    const { parsed } = compose('F1_donam3.txt');
    const body = mailBody({ template: getBlocks().mail_body, parsed, profile: getProfile(), settings: getSettings(), extraDocs: [] });
    expect(body).toContain('즉시 출근이 가능합니다.\n\n자세한 사항은 첨부한 이력서와 자기소개서를 참고 부탁드립니다.\n\n');
  });
  it('Gmail / mailto URL', () => {
    const u = new URL(gmailComposeUrl('a@b.com', '제목 테스트', '본문\n둘째 줄'));
    expect(u.origin + u.pathname).toBe('https://mail.google.com/mail/');
    expect(u.searchParams.get('view')).toBe('cm');
    expect(u.searchParams.get('fs')).toBe('1');
    expect(u.searchParams.get('to')).toBe('a@b.com');
    expect(u.searchParams.get('su')).toBe('제목 테스트');
    expect(u.searchParams.get('body')).toBe('본문\n둘째 줄');
    expect(mailtoUrl('a@b.com', '제목', '본문')).toBe(`mailto:a@b.com?subject=${encodeURIComponent('제목')}&body=${encodeURIComponent('본문')}`);
  });
  it('고용24 전용 접수 판별', () => {
    expect(isPortalOnly({ emails: [], apply_channels: ['고용24'] })).toBe(true);
    expect(isPortalOnly({ emails: ['a@b.com'], apply_channels: ['email', '고용24'] })).toBe(false);
  });
});
