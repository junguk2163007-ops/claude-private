import fs from 'node:fs';
import path from 'node:path';

export function dataDir(): string {
  const dir = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

/** seed/ (개인정보, gitignore) 가 있으면 그것을, 없으면 seed.example/ 을 쓴다. */
export function seedDir(): string {
  const candidates = [process.env.SEED_DIR, path.join(process.cwd(), 'seed'), path.join(process.cwd(), 'seed.example')].filter(
    Boolean,
  ) as string[];
  for (const c of candidates) {
    const p = path.resolve(c);
    if (fs.existsSync(path.join(p, 'profile.json'))) return p;
  }
  return path.resolve(process.cwd(), 'seed.example');
}

export function fontsDir(): string {
  return path.resolve(process.cwd(), 'assets', 'fonts');
}

/** data 폴더 밖으로 나가는 경로를 거부한다. */
export function resolveDataPath(rel: string): string {
  const base = dataDir();
  const p = path.resolve(base, rel);
  if (p !== base && !p.startsWith(base + path.sep)) throw new Error('invalid data path');
  return p;
}
