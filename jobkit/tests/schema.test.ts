import { describe, expect, it } from 'vitest';
import { SCHEMA_SQL } from '@/lib/db/schema';
import { ProfileSchema, SettingsSchema, QualificationSchema } from '@/lib/types';
import { getDb } from '@/lib/db';
import { getProfile, saveProfile } from '@/lib/db/repo';
import { freshDataDir } from './helpers';

// 주민등록번호/등본/통장 사본/계좌번호를 저장하는 필드가 없어야 한다.
const FORBIDDEN = /(rrn|resident|jumin|주민|등본|통장|계좌|account|bank|ssn)/i;

describe('개인정보 최소화 스키마', () => {
  it('SQL 스키마에 금지 컬럼이 없다', () => {
    freshDataDir();
    const db = getDb();
    const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all() as { name: string }[];
    for (const t of tables) {
      const cols = db.prepare(`PRAGMA table_info(${t.name})`).all() as { name: string }[];
      for (const c of cols) expect(c.name, `${t.name}.${c.name}`).not.toMatch(FORBIDDEN);
    }
    expect(SCHEMA_SQL.replace(/--.*$/gm, '')).not.toMatch(/(rrn|resident|jumin|account_no|bank)/i);
  });

  it('프로필 스키마 키에 금지 필드가 없고, 알 수 없는 키는 거부한다', () => {
    const keys = [
      ...Object.keys(ProfileSchema.shape),
      ...Object.keys(SettingsSchema.shape),
      ...Object.keys(QualificationSchema.shape),
    ];
    for (const k of keys) expect(k).not.toMatch(FORBIDDEN);
    expect(() => ProfileSchema.parse({ name: 'a', rrn: '840416-1234567' })).toThrow();
    freshDataDir();
    getDb();
    const p = getProfile();
    expect(() => saveProfile({ ...p, photo_file: undefined, account_number: '123' })).toThrow();
  });

  it('시드는 생년월일까지만 저장한다', () => {
    freshDataDir();
    const p = getProfile();
    expect(p.birth).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(p.careers.length).toBe(3);
    expect(p.licenses.map((l) => l.name)).toContain('공인중개사');
  });
});
