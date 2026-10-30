import { zipSync } from 'fflate';

/** 파일명은 UTF-8 로 기록된다 (fflate 는 비ASCII 이름에 EFS 플래그를 설정) */
export function makeZip(files: { name: string; data: Uint8Array }[]): Buffer {
  const entries: Record<string, Uint8Array> = {};
  for (const f of files) entries[f.name] = f.data;
  return Buffer.from(zipSync(entries, { level: 6 }));
}
