import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { closeDb } from '@/lib/db';

export const TODAY = '2026-10-24';

export function fixture(name: string): string {
  return fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
}

/** 테스트마다 빈 data 폴더를 만든다 (시드는 seed/ 또는 seed.example/ 에서 주입) */
export function freshDataDir(): string {
  closeDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobkit-test-'));
  process.env.DATA_DIR = dir;
  return dir;
}
