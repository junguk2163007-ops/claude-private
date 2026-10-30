// 흐름 검증: node validate.js
// - 모든 next/option이 존재하는 노드를 가리키는가
// - START에서 도달할 수 없는 노드가 없는가
// - 모든 노드에서 RECORD로 갈 수 있는가 (막다른 길 없음)
// - 순환은 허용된 것(G_RETRY → G)뿐인가
// - 층수는 F 표기만 쓰는가 (예: "23층" 금지)
// - sw.js 캐시 목록의 파일이 실제로 있는가
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { FLOW, START_ID, RECORD_ID, PAGES } from './flow.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ALLOWED_CYCLE_EDGES = [['G_RETRY', 'G']];
const TYPES = ['question', 'info', 'check', 'result', 'record'];

const errors = [];
const ok = [];
const err = (m) => errors.push(m);

// 노드의 나가는 간선
function edges(node) {
  const out = [];
  if (Array.isArray(node.options)) for (const o of node.options) out.push(o.next);
  else if (node.next) out.push(node.next);
  return out;
}

// 1) 구조 검사
const ids = Object.keys(FLOW);
for (const id of ids) {
  const n = FLOW[id];
  if (n.id !== id) err(`${id}: id 필드(${n.id})가 키와 다름`);
  if (!TYPES.includes(n.type)) err(`${id}: 알 수 없는 type "${n.type}"`);
  if (!n.title && !n.badge) err(`${id}: title 또는 badge가 필요함`);
  if (!n.stage) err(`${id}: stage가 없음`);
  if (n.body && !Array.isArray(n.body)) err(`${id}: body는 문장 배열이어야 함`);
  if (n.type === 'question') {
    if (!Array.isArray(n.options) || n.options.length < 2 || n.options.length > 3) err(`${id}: question은 options 2~3개가 필요함`);
    if (n.next) err(`${id}: question에는 next 대신 options를 씀`);
  }
  if (['info', 'check', 'result'].includes(n.type) && !n.next && !n.options) err(`${id}: next가 없음`);
  if (n.options) for (const [i, o] of n.options.entries()) {
    if (!o.label) err(`${id}: options[${i}] label 없음`);
    if (!o.next) err(`${id}: options[${i}] next 없음`);
  }
  if (n.type === 'check' && !(n.checks || []).some((c) => c.required)) err(`${id}: check 화면에 required 항목이 없음`);
  if (n.type === 'record' && edges(n).length) err(`${id}: record는 마지막 화면이어야 함`);
  for (const t of edges(n)) if (!FLOW[t]) err(`${id} → ${t}: 존재하지 않는 노드`);
}
if (!FLOW[START_ID]) err(`START 노드(${START_ID}) 없음`);
if (!FLOW[RECORD_ID] || FLOW[RECORD_ID].type !== 'record') err(`RECORD 노드(${RECORD_ID}) 없음 또는 type이 record가 아님`);
if (!errors.length) ok.push(`노드 ${ids.length}개 구조·링크 정상`);

// 2) 도달 가능성
const reach = new Set([START_ID]);
const queue = [START_ID];
while (queue.length) {
  const id = queue.shift();
  for (const t of edges(FLOW[id] || {})) if (FLOW[t] && !reach.has(t)) { reach.add(t); queue.push(t); }
}
const unreachable = ids.filter((id) => !reach.has(id));
if (unreachable.length) err(`도달 불가능한 노드: ${unreachable.join(', ')}`);
else ok.push('모든 노드가 START에서 도달 가능');

// 3) 막다른 길 — 역방향으로 RECORD에서 거슬러 올라감
const rev = {};
for (const id of ids) for (const t of edges(FLOW[id])) (rev[t] ||= []).push(id);
const toRecord = new Set([RECORD_ID]);
const q2 = [RECORD_ID];
while (q2.length) {
  const id = q2.shift();
  for (const p of rev[id] || []) if (!toRecord.has(p)) { toRecord.add(p); q2.push(p); }
}
const dead = ids.filter((id) => !toRecord.has(id));
if (dead.length) err(`RECORD로 이어지지 않는 노드: ${dead.join(', ')}`);
else ok.push('모든 노드가 RECORD로 이어짐 (막다른 길 없음)');

// 4) 순환 — 허용 간선을 뺀 그래프가 DAG인지, 허용 간선이 실제로 순환을 만드는지
const allowed = new Set(ALLOWED_CYCLE_EDGES.map(([a, b]) => `${a}>${b}`));
const indeg = Object.fromEntries(ids.map((id) => [id, 0]));
const fwd = {};
for (const id of ids) {
  fwd[id] = edges(FLOW[id]).filter((t) => FLOW[t] && !allowed.has(`${id}>${t}`));
  for (const t of fwd[id]) indeg[t]++;
}
const order = [];
const q3 = ids.filter((id) => indeg[id] === 0);
while (q3.length) {
  const id = q3.shift();
  order.push(id);
  for (const t of fwd[id]) if (--indeg[t] === 0) q3.push(t);
}
if (order.length !== ids.length) {
  // 남은 노드에서 순환 밖으로만 나가는 노드를 걷어 내 순환 부분만 남긴다
  const rest = new Set(ids.filter((id) => indeg[id] > 0));
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of rest) if (!fwd[id].some((t) => rest.has(t))) { rest.delete(id); changed = true; }
  }
  err(`의도하지 않은 순환: ${[...rest].join(', ')}`);
} else {
  for (const [a, b] of ALLOWED_CYCLE_EDGES) {
    if (!edges(FLOW[a] || {}).includes(b)) err(`허용 순환 간선 ${a} → ${b}가 흐름에 없음`);
  }
  ok.push(`순환은 허용된 ${ALLOWED_CYCLE_EDGES.map((e) => e.join(' → ')).join(', ')} 뿐`);
}

// 5) 층수 표기 — "23층" 같은 표기 금지 (23F로 씀)
const strings = [];
(function walk(v, path) {
  if (typeof v === 'string') strings.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${path}.${k}`);
})({ FLOW, PAGES }, '');
const floorBad = strings.filter(([, s]) => /\d\s*층/.test(s));
if (floorBad.length) floorBad.forEach(([p, s]) => err(`층수는 F로 표기: ${p} "${s}"`));
else ok.push('층수 표기는 모두 F 형식');

// 6) 시나리오 경로 — 사례 경로가 실제로 이어지는지
const SCENARIOS = {
  '#2 사례 (B. N선 단선)': ['START', 'Q_LIGHT:아니오', 'Q_RANGE:예', 'MEASURE', 'Q_LN:아니오', 'Q_LPE:예', 'Q_NPE:예', 'B', 'SAFE', 'LOCATE', 'RESTORE', 'RECORD'],
  '#1 사례 (E. 트립 → 정상 복귀)': ['START', 'Q_LIGHT:아니오', 'Q_RANGE:아니오', 'PANEL', 'Q_TRIP:예', 'E:아니오', 'E_OK', 'RESTORE', 'RECORD'],
  '전등 일부 불점등 → L_CTRL': ['START', 'Q_LIGHT:예', 'Q_LIGHT_ALL:아니오', 'Q_TENANT:아니오', 'Q_LIGHT_IN:아니오', 'L_CTRL', 'SAFE', 'LOCATE', 'RESTORE', 'RECORD'],
};
for (const [name, steps] of Object.entries(SCENARIOS)) {
  let good = true;
  for (let i = 0; i < steps.length - 1; i++) {
    const [id, ans] = steps[i].split(':');
    const nextId = steps[i + 1].split(':')[0];
    const n = FLOW[id];
    const target = ans ? n?.options?.find((o) => o.label === ans)?.next : n?.next;
    if (target !== nextId) { err(`시나리오 ${name}: ${steps[i]} 다음이 ${nextId}가 아님 (${target})`); good = false; break; }
  }
  if (good) ok.push(`시나리오 ${name} 경로 확인`);
}

// 7) 서비스워커 캐시 목록의 파일 존재
try {
  const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
  const list = sw.match(/ASSETS\s*=\s*\[([\s\S]*?)\]/)?.[1] || '';
  const files = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]).filter((f) => f !== './');
  const missing = files.filter((f) => !existsSync(join(ROOT, f)));
  if (missing.length) err(`sw.js 캐시 목록에 없는 파일: ${missing.join(', ')}`);
  else ok.push(`sw.js 캐시 파일 ${files.length}개 모두 존재`);
} catch (e) {
  err(`sw.js 읽기 실패: ${e.message}`);
}

for (const m of ok) console.log(`✔ ${m}`);
if (errors.length) {
  for (const m of errors) console.error(`✘ ${m}`);
  console.error(`\n검증 실패: 오류 ${errors.length}개`);
  process.exit(1);
}
console.log('\n검증 통과');
