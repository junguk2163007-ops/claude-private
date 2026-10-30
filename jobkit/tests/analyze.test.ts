import { beforeEach, describe, expect, it } from 'vitest';
import { analyze, type HistoryEntry } from '@/lib/analyze';
import { parsePosting } from '@/lib/parser';
import { listQualifications, getSettings } from '@/lib/db/repo';
import { fixture, freshDataDir, TODAY } from './helpers';

function run(file: string, history: HistoryEntry[] = []) {
  const text = fixture(file);
  const parsed = parsePosting(text, TODAY);
  const analysis = analyze(text, parsed, { qualifications: listQualifications(), settings: getSettings(), history, today: TODAY });
  return { parsed, analysis };
}

const row = (a: ReturnType<typeof run>['analysis'], name: string) => a.rows.find((r) => r.qualification_name === name);

beforeEach(() => {
  freshDataDir();
});

describe('F1 도남3단지', () => {
  it('요건 3개 [우대], 신호 초록, 근거리, GAP=소방', () => {
    const { analysis } = run('F1_donam3.txt');
    expect(analysis.rows).toHaveLength(3);
    expect(analysis.rows.every((r) => r.category === '우대')).toBe(true);
    expect(row(analysis, '아파트 근무 경력')?.verdict).toBe('미충족-장벽');
    expect(row(analysis, '소방안전관리자 보조')?.verdict).toBe('미충족-보완가능');
    expect(analysis.rows[2].verdict).toBe('직접 확인');
    expect(analysis.signal.level).toBe('green');
    expect(analysis.near).toBe(true);
    expect(analysis.gap_qualifications.map((g) => g.name)).toEqual(['소방안전관리자 보조']);
    expect(analysis.apt_exp_required_unmet).toBe(false);
    expect(analysis.warnings.map((w) => w.kind)).toContain('shift');
    expect(analysis.warnings.map((w) => w.kind)).not.toContain('distance');
  });
});

describe('F2 도남2단지', () => {
  it('요건 3개 [필수로 보임], 판정, 신호 빨강', () => {
    const { analysis } = run('F2_donam2.txt');
    expect(analysis.rows).toHaveLength(3);
    expect(analysis.rows.every((r) => r.category === '필수로 보임')).toBe(true);
    expect(row(analysis, '소방안전관리자 보조')?.verdict).toBe('미충족-보완가능');
    expect(row(analysis, '기계설비유지관리자')?.verdict).toBe('미충족-장벽');
    expect(row(analysis, '아파트 근무 경력')?.verdict).toBe('미충족-장벽');
    expect(row(analysis, '관련 업무 경력')).toBeUndefined(); // "아파트 및 관련 업무"가 더 긴 별칭으로 우선
    expect(analysis.signal.level).toBe('red');
    expect(analysis.gap_qualifications.map((g) => g.name)).toEqual(['소방안전관리자 보조']);
    expect(analysis.apt_exp_required_unmet).toBe(true);
    const kinds = analysis.warnings.map((w) => w.kind);
    expect(kinds).toEqual(expect.arrayContaining(['probation', 'start_date', 'shift']));
    expect(analysis.warnings.find((w) => w.kind === 'start_date')!.text).toContain('출근 예정일이 지났습니다');
  });
});

describe('F3 칠곡수정한양', () => {
  it('구분/판정, 등본·통장 경고, GAP=에너지+소방', () => {
    const { analysis } = run('F3_chilgok.txt');
    expect(row(analysis, '아파트 근무 경력')).toMatchObject({ category: '필수로 보임', verdict: '미충족-장벽' });
    expect(row(analysis, '소방안전관리자 보조')).toMatchObject({ category: '우대' });
    expect(row(analysis, '에너지관리기사')).toMatchObject({ category: '필수로 보임', verdict: '미충족-장벽', barrier: 'medium' });
    expect(row(analysis, '관련 업무 경력')).toMatchObject({ category: '우대' });
    expect(analysis.warnings.find((w) => w.kind === 'docs')?.text).toContain('주민번호 뒷자리 가림');
    expect(analysis.gap_qualifications.map((g) => g.name)).toEqual(['에너지관리기사', '소방안전관리자 보조']);
    expect(analysis.signal.level).toBe('red');
  });
});

describe('F4 수성알파시티', () => {
  it('근무조건 섹션의 소방은 [필수로 보임], 근거리 아님, 마감 지남', () => {
    const { analysis } = run('F4_suseong.txt');
    expect(row(analysis, '소방안전관리자 보조')).toMatchObject({ category: '필수로 보임', verdict: '미충족-보완가능' });
    expect(row(analysis, '관련 업무 경력')).toMatchObject({ category: '우대' });
    expect(analysis.near).toBe(false);
    expect(analysis.signal.level).toBe('yellow');
    const texts = analysis.warnings.map((w) => w.text).join('\n');
    expect(texts).toContain('통근 거리 직접 확인');
    expect(texts).toContain('마감일이 지났습니다');
  });
});

describe('지원 이력 대조', () => {
  it('같은 위탁사/이메일 → N번 지원함, 같은 단지 → 중복 지원', () => {
    const history: HistoryEntry[] = [
      { id: 1, created_at: '2026-09-01 10:00:00', site: '힐스테이트데시앙 도남3단지', company: '㈜맨투맨', emails: [], status: '지원함' },
      { id: 2, created_at: '2026-09-10 10:00:00', site: '다른단지', company: '', emails: ['hillde3@daum.net'], status: '불합격' },
      { id: 3, created_at: '2026-09-11 10:00:00', site: '힐스테이트데시앙 도남3단지', company: '', emails: [], status: '작성중' },
    ];
    const { analysis } = run('F1_donam3.txt', history);
    const t = analysis.warnings.map((w) => w.text).join('\n');
    expect(t).toContain('2번 지원함');
    expect(t).toContain('중복 지원');
    expect(analysis.history_matches.map((h) => h.id)).toEqual([1, 2]);
  });
});
