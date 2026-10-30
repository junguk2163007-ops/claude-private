import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { dataDir, seedDir } from '../paths';
import { SCHEMA_SQL } from './schema';
import {
  BLOCK_KEYS,
  BlocksSchema,
  ProfileSchema,
  QualificationSchema,
  SettingsSchema,
} from '../types';

type DB = Database.Database;

const g = globalThis as unknown as { __jobkitDb?: { dir: string; db: DB } };

export function getDb(): DB {
  const dir = dataDir();
  if (g.__jobkitDb && g.__jobkitDb.dir === dir) return g.__jobkitDb.db;
  if (g.__jobkitDb) g.__jobkitDb.db.close();
  const db = new Database(path.join(dir, 'jobkit.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  seedIfEmpty(db);
  g.__jobkitDb = { dir, db };
  return db;
}

export function closeDb() {
  if (g.__jobkitDb) {
    g.__jobkitDb.db.close();
    g.__jobkitDb = undefined;
  }
}

const SeedFileSchema = z.object({
  profile: ProfileSchema,
  qualifications: z.array(QualificationSchema).default([]),
  settings: SettingsSchema.default({}),
});

/** 첫 실행 때만 seed/*.json 을 DB 에 주입한다. */
function seedIfEmpty(db: DB) {
  const seeded = db.prepare(`SELECT value FROM meta WHERE key = 'seeded'`).get();
  if (seeded) return;
  const dir = seedDir();
  const raw = JSON.parse(fs.readFileSync(path.join(dir, 'profile.json'), 'utf8'));
  const seed = SeedFileSchema.parse(raw);
  const blocksRaw = JSON.parse(fs.readFileSync(path.join(dir, 'blocks.json'), 'utf8'));
  const blocks = BlocksSchema.parse(blocksRaw);

  const tx = db.transaction(() => {
    const p = seed.profile;
    db.prepare(
      `INSERT OR REPLACE INTO profile (id, name, birth, phone, email, address, education_json, military_json, licenses_json, careers_json, photo_file, updated_at)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, datetime('now'))`,
    ).run(
      p.name,
      p.birth,
      p.phone,
      p.email,
      p.address,
      JSON.stringify(p.education),
      JSON.stringify(p.military),
      JSON.stringify(p.licenses),
      JSON.stringify(p.careers),
    );
    const ins = db.prepare(
      `INSERT INTO qualifications (key, name, aliases_json, have, barrier, promisable, promise_phrase, hint, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    seed.qualifications.forEach((q, i) =>
      ins.run(q.key, q.name, JSON.stringify(q.aliases), q.have ? 1 : 0, q.barrier, q.promisable ? 1 : 0, q.promise_phrase, q.hint, i),
    );
    const insB = db.prepare(`INSERT OR REPLACE INTO blocks (key, text) VALUES (?, ?)`);
    for (const k of BLOCK_KEYS) insB.run(k, blocks[k]);
    db.prepare(`INSERT OR REPLACE INTO settings (key, value_json) VALUES ('app', ?)`).run(JSON.stringify(seed.settings));
    db.prepare(`INSERT INTO meta (key, value) VALUES ('seeded', datetime('now'))`).run();
  });
  tx();
}
