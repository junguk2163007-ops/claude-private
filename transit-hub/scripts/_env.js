// 도우미 스크립트 전용(Node). 환경변수 → .dev.vars 순으로 키를 읽는다. 키는 출력하지 않는다.
import { readFileSync } from 'node:fs';

export function loadVar(name) {
  if (process.env[name]) return process.env[name];
  try {
    const txt = readFileSync(new URL('../.dev.vars', import.meta.url), 'utf8');
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, '');
    }
  } catch {
    /* .dev.vars 없음 */
  }
  return '';
}
