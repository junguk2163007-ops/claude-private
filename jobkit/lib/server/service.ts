// 화면/API 에서 쓰는 서버 측 조합 로직

import fs from 'node:fs';
import path from 'node:path';
import { analyze, type Analysis, type HistoryEntry } from '../analyze';
import {
  createApplication,
  getApplication,
  getBlocks,
  getProfile,
  getSettings,
  listApplications,
  listQualifications,
  readPhoto,
  updateApplication,
} from '../db/repo';
import { mailBody, mailSubject } from '../mail';
import type { ParsedPosting } from '../parser';
import { dataDir, resolveDataPath } from '../paths';
import { generateDocuments } from '../render';
import { applyTarget, checkProfile, type ProfileCheck } from '../render/compose';
import type { Application } from '../types';
import { todaySeoul } from '../util/date';
import { docFileName } from '../util/filename';

export function historyEntries(): HistoryEntry[] {
  return listApplications().map((a) => ({
    id: a.id,
    created_at: a.created_at,
    site: a.site,
    company: a.company,
    emails: a.emails,
    status: a.status,
  }));
}

export function runAnalysis(text: string, parsed: ParsedPosting, currentApplicationId?: number | null): Analysis {
  return analyze(text, parsed, {
    qualifications: listQualifications(),
    settings: getSettings(),
    history: historyEntries(),
    today: todaySeoul(),
    currentApplicationId: currentApplicationId ?? null,
  });
}

export function profileCheck(): ProfileCheck {
  return checkProfile(getProfile());
}

export interface GenerateRequest {
  text: string;
  parsed: ParsedPosting;
  extraDocs: string[];
  applicationId?: number | null;
}

export interface GenerateResponse {
  application: Application;
  resumePages: number;
  letterPages: number;
  resumeFontPt: number;
  warnings: string[];
  profileCheck: ProfileCheck;
  files: { resume: string; letter: string; zip: string };
}

export async function generateForPosting(req: GenerateRequest): Promise<GenerateResponse> {
  const profile = getProfile();
  const blocks = getBlocks();
  const settings = getSettings();
  const today = todaySeoul();
  const analysis = runAnalysis(req.text, req.parsed, req.applicationId);
  const result = await generateDocuments({ profile, blocks, parsed: req.parsed, analysis, today, photo: readPhoto() });

  const subject = mailSubject(req.parsed, profile.name);
  const body = mailBody({ template: blocks.mail_body, parsed: req.parsed, profile, settings, extraDocs: req.extraDocs });
  const p = req.parsed;
  const fields = {
    site: p.site.trim(),
    title: p.title.trim(),
    company: p.company.trim(),
    address: p.address.trim(),
    phone: p.phone.trim(),
    emails: p.emails,
    deadline: p.deadline,
    shift: p.shift,
    salary_text: p.salary_text,
    required_phrase: p.required_phrase,
    posting_text: req.text,
    parsed_json: JSON.stringify(p),
    mail_subject: subject,
    mail_body: body,
    selected_email: p.emails[0] ?? null,
    extra_docs: req.extraDocs,
  };

  // 작성중인 같은 건이면 덮어쓰고, 이미 지원함 이후 상태면 새 건으로 만든다(보낸 서류 보존).
  const existing = req.applicationId ? getApplication(req.applicationId) : null;
  const app =
    existing && existing.status === '작성중'
      ? updateApplication(existing.id, fields)!
      : createApplication({ ...fields, resume_pdf_path: null, letter_pdf_path: null });

  const relDir = path.join('pdf', String(app.id));
  fs.mkdirSync(path.join(dataDir(), relDir), { recursive: true });
  const resumeRel = path.join(relDir, 'resume.pdf');
  const letterRel = path.join(relDir, 'letter.pdf');
  fs.writeFileSync(resolveDataPath(resumeRel), result.resume.pdf);
  fs.writeFileSync(resolveDataPath(letterRel), result.letter.pdf);
  const saved = updateApplication(app.id, { resume_pdf_path: resumeRel, letter_pdf_path: letterRel })!;

  return {
    application: saved,
    resumePages: result.resume.pages,
    letterPages: result.letter.pages,
    resumeFontPt: result.resume.level.fs,
    warnings: result.warnings,
    profileCheck: checkProfile(profile),
    files: fileNames(saved),
  };
}

export function fileNames(app: Pick<Application, 'site'>) {
  const name = getProfile().name || '지원자';
  return {
    resume: docFileName('이력서', name, app.site, 'pdf'),
    letter: docFileName('자기소개서', name, app.site, 'pdf'),
    zip: docFileName('지원서류', name, app.site, 'zip'),
  };
}

export { applyTarget };
