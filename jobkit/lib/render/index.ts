import type { Analysis } from '../analyze';
import type { ParsedPosting } from '../parser';
import type { Blocks, Profile } from '../types';
import { composeLetter, composeResume, type LetterData, type ResumeData } from './compose';
import { renderFitted, type FitResult } from './pdf';
import { type Level, letterHtml, resumeHtml } from './templates';

// 이력서: A4 1페이지. 넘치면 글자·여백을 줄이되 9pt 아래로는 내리지 않는다.
export const RESUME_LEVELS: Level[] = [
  { fs: 10.5, pad: 14, lh: 1.5, gap: 4 },
  { fs: 10.5, pad: 12, lh: 1.45, gap: 3.5 },
  { fs: 10, pad: 12, lh: 1.45, gap: 3.5 },
  { fs: 10, pad: 11, lh: 1.4, gap: 3 },
  { fs: 9.5, pad: 11, lh: 1.4, gap: 3 },
  { fs: 9.5, pad: 10, lh: 1.35, gap: 2.5 },
  { fs: 9, pad: 10, lh: 1.35, gap: 2.5 },
  { fs: 9, pad: 8, lh: 1.3, gap: 2 },
];

// 자기소개서: 1페이지 목표 → 안 되면 2페이지 허용
export const LETTER_LEVELS_1P: Level[] = [
  { fs: 11, pad: 18, lh: 1.75, gap: 5 },
  { fs: 10.5, pad: 16, lh: 1.7, gap: 4.5 },
  { fs: 10, pad: 14, lh: 1.65, gap: 4 },
];
export const LETTER_LEVELS_2P: Level[] = [
  { fs: 11, pad: 18, lh: 1.75, gap: 5 },
  { fs: 10, pad: 14, lh: 1.6, gap: 4 },
  { fs: 9, pad: 12, lh: 1.5, gap: 3 },
];

export interface GenerateInput {
  profile: Profile;
  blocks: Blocks;
  parsed: ParsedPosting;
  analysis: Analysis;
  today: string;
  photo: { data: Buffer; mime: string } | null;
}

export interface GenerateResult {
  resume: FitResult;
  letter: FitResult;
  resumeData: ResumeData;
  letterData: LetterData;
  warnings: string[];
}

export async function generateDocuments(input: GenerateInput): Promise<GenerateResult> {
  const resumeData = composeResume(input);
  const letterData = composeLetter(input);
  const photoUri = input.photo ? `data:${input.photo.mime};base64,${input.photo.data.toString('base64')}` : null;

  const resume = await renderFitted(resumeHtml(resumeData, RESUME_LEVELS[0], photoUri), RESUME_LEVELS, 1);
  let letter = await renderFitted(letterHtml(letterData, LETTER_LEVELS_1P[0]), LETTER_LEVELS_1P, 1);
  if (letter.overflow) letter = await renderFitted(letterHtml(letterData, LETTER_LEVELS_2P[0]), LETTER_LEVELS_2P, 2);

  const warnings: string[] = [];
  if (resume.overflow)
    warnings.push(`이력서가 최소 글자 크기(9pt)로도 1페이지를 넘습니다(${resume.pages}쪽). 경력·소개 문구를 줄여 주세요.`);
  if (letter.overflow) warnings.push(`자기소개서가 2페이지를 넘습니다(${letter.pages}쪽). 블록 문구를 줄여 주세요.`);
  return { resume, letter, resumeData, letterData, warnings };
}
