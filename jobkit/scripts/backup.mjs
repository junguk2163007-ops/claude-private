// 사용법: node scripts/backup.mjs [출력폴더]
// 실행 중에도 안전한 SQLite 스냅샷(jobkit.db) + 사진 + PDF 를 한 폴더로 복사한다.
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const dataDir = path.resolve(process.env.DATA_DIR || 'data');
const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13);
const out = path.resolve(process.argv[2] || path.join('backups', `jobkit-${stamp}`));
fs.mkdirSync(out, { recursive: true });

const db = new Database(path.join(dataDir, 'jobkit.db'), { readonly: true, fileMustExist: true });
await db.backup(path.join(out, 'jobkit.db'));
db.close();
for (const dir of ['photo', 'pdf']) {
  const src = path.join(dataDir, dir);
  if (fs.existsSync(src)) fs.cpSync(src, path.join(out, dir), { recursive: true });
}
console.log(`백업 완료: ${out}`);
