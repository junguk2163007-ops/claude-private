import fs from 'node:fs';
import { getDb } from './index';
import { resolveDataPath } from '../paths';
import { nowSeoulIso } from '../util/date';
import {
  APPLICATION_STATUSES,
  BLOCK_KEYS,
  type Application,
  type ApplicationStatus,
  type Blocks,
  type Profile,
  type ProfileData,
  ProfileSchema,
  type Qualification,
  QualificationSchema,
  type Settings,
  SettingsSchema,
  BlocksSchema,
} from '../types';
import { z } from 'zod';

// ---------- profile ----------

interface ProfileRow {
  name: string;
  birth: string;
  phone: string;
  email: string;
  address: string;
  education_json: string;
  military_json: string;
  licenses_json: string;
  careers_json: string;
  photo_file: string | null;
}

export function getProfile(): Profile {
  const row = getDb().prepare(`SELECT * FROM profile WHERE id = 1`).get() as ProfileRow | undefined;
  if (!row) return { ...ProfileSchema.parse({}), photo_file: null };
  const data = ProfileSchema.parse({
    name: row.name,
    birth: row.birth,
    phone: row.phone,
    email: row.email,
    address: row.address,
    education: JSON.parse(row.education_json),
    military: JSON.parse(row.military_json),
    licenses: JSON.parse(row.licenses_json),
    careers: JSON.parse(row.careers_json),
  });
  return { ...data, photo_file: row.photo_file };
}

export function saveProfile(input: unknown): ProfileData {
  const p = ProfileSchema.parse(input);
  getDb()
    .prepare(
      `UPDATE profile SET name=?, birth=?, phone=?, email=?, address=?, education_json=?, military_json=?, licenses_json=?, careers_json=?, updated_at=? WHERE id=1`,
    )
    .run(
      p.name,
      p.birth,
      p.phone,
      p.email,
      p.address,
      JSON.stringify(p.education),
      JSON.stringify(p.military),
      JSON.stringify(p.licenses),
      JSON.stringify(p.careers),
      nowSeoulIso(),
    );
  return p;
}

export function setPhotoFile(file: string | null) {
  getDb().prepare(`UPDATE profile SET photo_file=? WHERE id=1`).run(file);
}

export function readPhoto(): { data: Buffer; mime: string } | null {
  const p = getProfile();
  if (!p.photo_file) return null;
  const abs = resolveDataPath(p.photo_file);
  if (!fs.existsSync(abs)) return null;
  const ext = p.photo_file.split('.').pop();
  const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  return { data: fs.readFileSync(abs), mime };
}

// ---------- qualifications ----------

interface QualRow {
  id: number;
  key: string | null;
  name: string;
  aliases_json: string;
  have: number;
  barrier: Qualification['barrier'];
  promisable: number;
  promise_phrase: string;
  hint: string;
}

export function listQualifications(): Qualification[] {
  const rows = getDb().prepare(`SELECT * FROM qualifications ORDER BY sort, id`).all() as QualRow[];
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    aliases: JSON.parse(r.aliases_json),
    have: !!r.have,
    barrier: r.barrier,
    promisable: !!r.promisable,
    promise_phrase: r.promise_phrase,
    hint: r.hint,
  }));
}

/** 전체 목록 교체 저장 (id 가 있으면 유지) */
export function saveQualifications(input: unknown): Qualification[] {
  const list = z.array(QualificationSchema).parse(input);
  const db = getDb();
  const tx = db.transaction(() => {
    const keepIds = list.filter((q) => q.id).map((q) => q.id!);
    const existing = (db.prepare(`SELECT id FROM qualifications`).all() as { id: number }[]).map((r) => r.id);
    const del = db.prepare(`DELETE FROM qualifications WHERE id=?`);
    for (const id of existing) if (!keepIds.includes(id)) del.run(id);
    const upd = db.prepare(
      `UPDATE qualifications SET key=?, name=?, aliases_json=?, have=?, barrier=?, promisable=?, promise_phrase=?, hint=?, sort=? WHERE id=?`,
    );
    const ins = db.prepare(
      `INSERT INTO qualifications (key, name, aliases_json, have, barrier, promisable, promise_phrase, hint, sort) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    list.forEach((q, i) => {
      const aliases = Array.from(new Set(q.aliases.map((a) => a.trim()).filter(Boolean)));
      const vals = [q.key, q.name.trim(), JSON.stringify(aliases), q.have ? 1 : 0, q.barrier, q.promisable ? 1 : 0, q.promise_phrase, q.hint, i] as const;
      if (q.id && existing.includes(q.id)) upd.run(...vals, q.id);
      else ins.run(...vals);
    });
  });
  tx();
  return listQualifications();
}

export function setQualificationHave(id: number, have: boolean) {
  getDb().prepare(`UPDATE qualifications SET have=? WHERE id=?`).run(have ? 1 : 0, id);
}

// ---------- blocks ----------

export function getBlocks(): Blocks {
  const rows = getDb().prepare(`SELECT key, text FROM blocks`).all() as { key: string; text: string }[];
  const map = Object.fromEntries(rows.map((r) => [r.key, r.text]));
  const out = {} as Blocks;
  for (const k of BLOCK_KEYS) out[k] = map[k] ?? '';
  return out;
}

export function saveBlocks(input: unknown): Blocks {
  const b = BlocksSchema.parse(input);
  const db = getDb();
  const st = db.prepare(`INSERT OR REPLACE INTO blocks (key, text) VALUES (?, ?)`);
  db.transaction(() => {
    for (const k of BLOCK_KEYS) st.run(k, b[k]);
  })();
  return b;
}

// ---------- settings ----------

export function getSettings(): Settings {
  const row = getDb().prepare(`SELECT value_json FROM settings WHERE key='app'`).get() as { value_json: string } | undefined;
  return SettingsSchema.parse(row ? JSON.parse(row.value_json) : {});
}

export function saveSettings(input: unknown): Settings {
  const s = SettingsSchema.parse(input);
  s.near_keywords = Array.from(new Set(s.near_keywords.map((k) => k.trim()).filter(Boolean)));
  getDb().prepare(`INSERT OR REPLACE INTO settings (key, value_json) VALUES ('app', ?)`).run(JSON.stringify(s));
  return s;
}

// ---------- applications ----------

interface AppRow extends Omit<Application, 'emails' | 'extra_docs'> {
  emails: string;
  extra_docs: string;
}

function toApp(r: AppRow): Application {
  return { ...r, emails: JSON.parse(r.emails || '[]'), extra_docs: JSON.parse(r.extra_docs || '[]') };
}

export function listApplications(): Application[] {
  const rows = getDb().prepare(`SELECT * FROM applications ORDER BY created_at DESC, id DESC`).all() as AppRow[];
  return rows.map(toApp);
}

export function getApplication(id: number): Application | null {
  const r = getDb().prepare(`SELECT * FROM applications WHERE id=?`).get(id) as AppRow | undefined;
  return r ? toApp(r) : null;
}

export type ApplicationInput = Omit<Application, 'id' | 'created_at' | 'updated_at' | 'status' | 'memo'> & {
  status?: ApplicationStatus;
  memo?: string;
};

export function createApplication(a: ApplicationInput): Application {
  const now = nowSeoulIso();
  const info = getDb()
    .prepare(
      `INSERT INTO applications (created_at, updated_at, site, title, company, address, phone, emails, deadline, shift, salary_text, required_phrase,
        posting_text, parsed_json, resume_pdf_path, letter_pdf_path, mail_subject, mail_body, selected_email, extra_docs, status, memo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      now,
      now,
      a.site,
      a.title,
      a.company,
      a.address,
      a.phone,
      JSON.stringify(a.emails),
      a.deadline,
      a.shift,
      a.salary_text,
      a.required_phrase,
      a.posting_text,
      a.parsed_json,
      a.resume_pdf_path,
      a.letter_pdf_path,
      a.mail_subject,
      a.mail_body,
      a.selected_email,
      JSON.stringify(a.extra_docs),
      a.status ?? '작성중',
      a.memo ?? '',
    );
  return getApplication(Number(info.lastInsertRowid))!;
}

const UPDATABLE = [
  'site',
  'title',
  'company',
  'address',
  'phone',
  'emails',
  'deadline',
  'shift',
  'salary_text',
  'required_phrase',
  'posting_text',
  'parsed_json',
  'resume_pdf_path',
  'letter_pdf_path',
  'mail_subject',
  'mail_body',
  'selected_email',
  'extra_docs',
  'status',
  'memo',
] as const;

export function updateApplication(id: number, patch: Partial<Omit<Application, 'id' | 'created_at' | 'updated_at'>>): Application | null {
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const k of UPDATABLE) {
    if (!(k in patch)) continue;
    let v = (patch as Record<string, unknown>)[k];
    if (k === 'status' && !APPLICATION_STATUSES.includes(v as ApplicationStatus)) throw new Error('invalid status');
    if (k === 'emails' || k === 'extra_docs') v = JSON.stringify(v ?? []);
    sets.push(`${k}=?`);
    vals.push(v);
  }
  if (sets.length) {
    sets.push('updated_at=?');
    vals.push(nowSeoulIso());
    getDb()
      .prepare(`UPDATE applications SET ${sets.join(', ')} WHERE id=?`)
      .run(...vals, id);
  }
  return getApplication(id);
}

export function deleteApplication(id: number) {
  const a = getApplication(id);
  if (!a) return;
  for (const p of [a.resume_pdf_path, a.letter_pdf_path]) {
    if (!p) continue;
    try {
      fs.rmSync(resolveDataPath(p), { force: true });
    } catch {
      /* ignore */
    }
  }
  getDb().prepare(`DELETE FROM applications WHERE id=?`).run(id);
}
