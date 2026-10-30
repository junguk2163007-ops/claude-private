import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { analyze } from '@/lib/analyze';
import { parsePosting } from '@/lib/parser';
import { getBlocks, getProfile, getSettings, listQualifications } from '@/lib/db/repo';
import { generateDocuments } from '@/lib/render';
import { closeBrowser } from '@/lib/render/pdf';
import type { Blocks } from '@/lib/types';
import { embeddedFonts, pdfText, solidPng } from './pdfutil';
import { fixture, freshDataDir, TODAY } from './helpers';

const FIXTURES = ['F1_donam3.txt', 'F2_donam2.txt', 'F3_chilgok.txt', 'F4_suseong.txt'];
const photo = { data: solidPng(300, 400, [200, 210, 220]), mime: 'image/png' };

async function gen(file: string, withPhoto = true, blocksPatch: Partial<Blocks> = {}) {
  const text = fixture(file);
  const parsed = parsePosting(text, TODAY);
  const analysis = analyze(text, parsed, { qualifications: listQualifications(), settings: getSettings(), today: TODAY });
  return generateDocuments({
    profile: getProfile(),
    blocks: { ...getBlocks(), ...blocksPatch },
    parsed,
    analysis,
    today: TODAY,
    photo: withPhoto ? photo : null,
  });
}

beforeAll(() => {
  freshDataDir();
});
afterAll(async () => {
  await closeBrowser();
});

const squash = (s: string) => s.replace(/\s+/g, '');

describe.each(FIXTURES)('PDF 렌더링 %s', (file) => {
  it('이력서 정확히 1페이지, 자기소개서 2페이지 이하, 한글 폰트 임베드, 글자 깨짐 없음', async () => {
    const r = await gen(file);
    expect(r.resume.pages).toBe(1);
    expect(r.resume.overflow).toBe(false);
    expect(r.letter.pages).toBeLessThanOrEqual(2);
    expect(r.warnings).toEqual([]);

    for (const pdf of [r.resume.pdf, r.letter.pdf]) {
      const fonts = await embeddedFonts(pdf);
      expect(fonts.length).toBeGreaterThan(0);
      expect(fonts.every((f) => f.embedded)).toBe(true);
      expect(fonts.every((f) => /NotoSansKR/.test(f.name))).toBe(true);
    }

    const resumeText = squash((await pdfText(r.resume.pdf)).join(''));
    expect(resumeText).toContain('이력서');
    expect(resumeText).toContain(squash(r.resumeData.target));
    expect(resumeText).toContain(squash(r.resumeData.name));
    expect(resumeText).toContain('위내용은사실과다름이없습니다.');
    expect(resumeText).toContain('2026년10월24일');
    expect(resumeText).not.toMatch(/확인필요|\*\*|�/);

    const letterText = squash((await pdfText(r.letter.pdf)).join(''));
    expect(letterText).toContain('자기소개서');
    for (const s of r.letterData.sections) expect(letterText).toContain(squash(s.title));
    expect(letterText).toContain('즉시출근이가능');
    expect(letterText).not.toMatch(/확인필요|\*\*|�|\{GAP\}|\{sales_years\}/);
  });
});

describe('PDF 세부', () => {
  it('사진이 없으면 "사진 부착" 점선 박스, 빈 발급기관은 "-"', async () => {
    const r = await gen('F1_donam3.txt', false);
    const t = squash((await pdfText(r.resume.pdf)).join(''));
    expect(t).toContain('사진부착');
    expect(t).toContain('공인중개사-2023');
  });

  it('내용이 길면 글자/여백을 줄여 1페이지에 맞추고 9pt 미만으로는 내리지 않는다', async () => {
    const long = '성실하게 근무하겠습니다. '.repeat(20);
    const r = await gen('F2_donam2.txt', true, { resume_intro_1: long, resume_intro_2: long });
    expect(r.resume.level.fs).toBeGreaterThanOrEqual(9);
    if (!r.resume.overflow) {
      expect(r.resume.pages).toBe(1);
      expect(r.resume.level.fs).toBeLessThan(10.5);
    }
  });

  it('그래도 넘치면 경고', async () => {
    const huge = '성실하게 근무하겠습니다. '.repeat(120);
    const r = await gen('F2_donam2.txt', true, { resume_intro_1: huge });
    expect(r.resume.overflow).toBe(true);
    expect(r.resume.level.fs).toBe(9);
    expect(r.resume.level.pad).toBe(8);
    expect(r.warnings.join()).toContain('1페이지를 넘습니다');
  });
});
