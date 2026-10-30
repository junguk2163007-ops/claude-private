import { describe, expect, it } from 'vitest';
import { parsePosting, parseDates, parseSalaryAmount, classifyShift, cleanTitle } from '@/lib/parser';
import { fixture, TODAY } from './helpers';

describe('F1 도남3단지 (표 형식)', () => {
  const p = parsePosting(fixture('F1_donam3.txt'), TODAY);
  it('기본 필드', () => {
    expect(p.site).toBe('힐스테이트데시앙 도남3단지');
    expect(p.title).toBe('시설주임');
    expect(p.company).toBe('(주)맨투맨');
    expect(p.address).toBe('대구광역시 북구 도남중앙로7길 7(국우동)');
    expect(p.salary_text).toBe('3,374,440원');
    expect(p.salary_amount).toBe(3374440);
    expect(p.shift).toBe('격일');
    expect(p.emails).toEqual(['hillde3@daum.net']);
    expect(p.deadline).toBeNull();
    expect(p.start_date).toBeNull();
  });
  it('필수 기재 문구는 따옴표 안 글자 그대로', () => {
    expect(p.required_phrase).toBe('힐스테이트데시앙 도남3단지 시설주임 지원');
  });
  it('요건 3개 모두 [우대]', () => {
    expect(p.requirements).toHaveLength(3);
    expect(p.requirements.every((r) => r.category === '우대')).toBe(true);
    expect(p.requirements[0].line).toBe('아파트 경력자 우대');
  });
  it('제출서류', () => {
    expect(p.submit_docs).toEqual(['이력서', '자격증 사본']);
    expect(p.apply_channels).toEqual(['email']);
  });
});

describe('F2 도남2단지 (번호 목록)', () => {
  const p = parsePosting(fixture('F2_donam2.txt'), TODAY);
  it('기본 필드', () => {
    expect(p.site).toBe('동우/힐스테이트데시앙도남2단지');
    expect(p.title).toBe('시설주임');
    expect(p.company).toBe('동우씨엠(주)');
    expect(p.address).toBe('대구 북구 도남길 16');
    expect(p.salary_text).toBe('3,419,100원');
    expect(p.shift).toBe('격일');
    expect(p.required_phrase).toBeNull();
    expect(p.start_date).toBe('2026-10-01');
    expect(p.emails).toEqual(['jobdwcm@dongwoocm.co.kr']);
  });
  it('요건 3개 모두 [필수로 보임]', () => {
    expect(p.requirements.map((r) => r.category)).toEqual(['필수로 보임', '필수로 보임', '필수로 보임']);
  });
  it('수습/평가 문구, 고용24 접수', () => {
    expect(p.flags.probation).toContain('3개월 근무 후 근무 평가');
    expect(p.apply_channels).toContain('고용24');
    expect(p.apply_channels).toContain('email');
  });
});

describe('F3 칠곡수정한양 (따옴표 없는 필수 표기)', () => {
  const p = parsePosting(fixture('F3_chilgok.txt'), TODAY);
  it('기본 필드', () => {
    expect(p.site).toBe('칠곡수정한양아파트');
    expect(p.title).toBe('시설주임');
    expect(p.company).toBe('(주)광명티엠씨');
    expect(p.shift).toBe('상근');
    expect(p.address).toBe('');
  });
  it('"필수 표기" 앞 문구 추출', () => {
    expect(p.required_phrase).toBe('칠곡수정한양아파트 시설주임');
  });
  it('요건 구분', () => {
    const byLine = Object.fromEntries(p.requirements.map((r) => [r.line, r.category]));
    expect(byLine['아파트 근무 유경험자']).toBe('필수로 보임');
    expect(byLine['소방안전관리자 보조자격 선임가능자 우대']).toBe('우대');
    expect(byLine['에너지 관리기사']).toBe('필수로 보임');
    expect(byLine['관련 업무 유경험자 우대']).toBe('우대');
  });
  it('등본·통장 사본 감지', () => {
    expect(p.submit_docs).toEqual(expect.arrayContaining(['주민등록등본', '통장 사본', '자격증 사본']));
  });
});

describe('F4 수성알파시티 (섹션 제목 형식)', () => {
  const p = parsePosting(fixture('F4_suseong.txt'), TODAY);
  it('기본 필드', () => {
    expect(p.site).toBe('수성알파시티청아람');
    expect(p.title).toBe('관리주임');
    expect(p.address).toBe('대구 수성구 알파시티2로 96');
    expect(p.deadline).toBe('2026-10-18');
    expect(p.salary_text).toBe('월 343만원');
    expect(p.salary_amount).toBe(3430000);
    expect(p.shift).toBe('격일');
    expect(p.required_phrase).toBe('수성알파시티청아람 / 관리주임 지원');
  });
});

describe('보조 함수', () => {
  it('날짜', () => {
    expect(parseDates('2026년 10월 6일', 2026)).toEqual(['2026-10-06']);
    expect(parseDates('2026년 10월 01일', 2026)).toEqual(['2026-10-01']);
    expect(parseDates('2026.10.01 ~ 2026.10.18', 2026)).toEqual(['2026-10-01', '2026-10-18']);
    expect(parseDates('11월 3일까지', 2026)).toEqual(['2026-11-03']);
  });
  it('채용시까지는 null', () => {
    const p = parsePosting('단지명 : 테스트아파트\n채용정보 : 경비원\n마감일자 : 채용시까지', TODAY);
    expect(p.deadline).toBeNull();
  });
  it('급여', () => {
    expect(parseSalaryAmount('337 만원')).toBe(3370000);
    expect(parseSalaryAmount('3,374,440원')).toBe(3374440);
  });
  it('근무형태', () => {
    expect(classifyShift('3교대 근무')).toBe('3교대');
    expect(classifyShift('주당비 근무')).toBe('3교대');
    expect(classifyShift('주야교대')).toBe('주야교대');
    expect(classifyShift('평일 09:00~18:00')).toBe('상근');
  });
  it('직책 장식 제거, 괄호 병기 유지', () => {
    expect(cleanTitle('【 시설주임(기전주임) 】')).toBe('시설주임(기전주임)');
    expect(cleanTitle('★ 시설주임 구인 ★')).toBe('시설주임');
    expect(cleanTitle('◀ 시설 주임 ▶')).toBe('시설주임');
  });
  it('연락처, 휴게시간', () => {
    const p = parsePosting('단지명 : 테스트\n담당자 연락처 : 053-123-4567\n휴게시간 : 4시간\n근무처전화 053 999 8888', TODAY);
    expect(p.phone).toBe('053-123-4567');
    expect(p.phones).toContain('053-999-8888');
    expect(p.break_time).toBe('4시간');
  });
  it('필수 기재 문구가 양식(○○)이면 추출하지 않는다', () => {
    const p = parsePosting('메일 제목에 "지원분야_성명" 필수 기재', TODAY);
    expect(p.required_phrase).toBeNull();
  });
});
