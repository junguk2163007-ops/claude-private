// 화면 렌더링·상태·내비게이션. 흐름 내용은 flow.js에만 있다.
import { FLOW, START_ID, RECORD_ID, PAGES, FOOTER } from './flow.js';

/* ───────── 공통 도우미 ───────── */
const $ = (sel) => document.querySelector(sel);
const PROPS = new Set(['value', 'checked', 'disabled', 'readOnly']);

// DOM 생성: h('div', {class:'x', onclick:fn}, '텍스트', 자식...)
function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (PROPS.has(k)) el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}
const asList = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

// 저장소 — 사파리 개인정보 보호 모드 등에서 실패해도 앱은 동작
const store = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 무시 */ } },
};
const KEY_STATE = 'sqelec:state:v1';
const KEY_THEME = 'sqelec:theme';
const KEY_DISPATCH = 'sqelec:dispatch';

/* ───────── 상태 ───────── */
// stack: 지나온 화면 [{id, ans, ak, checks}] — 마지막 항목이 현재 화면
function freshState() {
  return {
    v: 1,
    stack: [{ id: START_ID, ans: null, ak: null, checks: {} }],
    measure: { ln: '', lpe: '', npe: '', load: false },
    record: {},
    startedAt: Date.now(),
    savedAt: Date.now(),
  };
}
let state = freshState();
let views = [];          // 열린 메뉴 보기 화면 (history와 동기화)
let mode = 'flow';       // flow | resume
let pendingSaved = null; // 이어서 하기 대기 중인 상태
let pendingReset = false;

const cur = () => state.stack[state.stack.length - 1];
const node = (id) => FLOW[id];

function save() {
  state.savedAt = Date.now();
  store.set(KEY_STATE, state);
}
function loadSaved() {
  const s = store.get(KEY_STATE);
  if (!s || s.v !== 1 || !Array.isArray(s.stack) || !s.stack.length) return null;
  if (!s.stack.every((e) => e && FLOW[e.id])) return null; // 흐름이 바뀌어 맞지 않으면 버림
  s.measure ||= { ln: '', lpe: '', npe: '', load: false };
  s.record ||= {};
  s.stack.forEach((e) => { e.checks ||= {}; });
  return s;
}
function hasProgress(s) {
  const m = s.measure || {};
  return s.stack.length > 1 || !!(m.ln || m.lpe || m.npe) || Object.values(s.record || {}).some(Boolean);
}

/* ───────── history 동기화 ───────── */
const hs = (depth, v = views) => ({ app: 1, depth, views: [...v] });

function choose(label, kind, next) {
  const top = cur();
  top.ans = label;
  top.ak = kind;
  state.stack.push({ id: next, ans: null, ak: null, checks: {} });
  save();
  history.pushState(hs(state.stack.length, []), '', `#${next}`);
  render();
}

function goBack() {
  if (views.length || state.stack.length > 1) history.back();
}

// 스택을 depth까지 되돌리고, 돌아간 화면의 답변도 지운다
function truncateTo(depth) {
  if (depth >= state.stack.length) return;
  const removed = state.stack.splice(depth);
  const top = cur();
  top.ans = null;
  top.ak = null;
  // 측정 화면을 되돌려 나가면 측정값도 되돌린다
  if (removed.some((e) => node(e.id).measure) && !state.stack.some((e) => node(e.id).measure)) {
    state.measure = { ln: '', lpe: '', npe: '', load: false };
  }
  // 기록 화면을 벗어나면 자동 판정을 다시 계산하도록 수동 판정 비움
  if (removed.some((e) => e.id === RECORD_ID)) delete state.record.verdict;
  save();
}

window.addEventListener('popstate', (e) => {
  closeModal(false);
  const s = e.state && e.state.app ? e.state : hs(1, []);
  if (pendingReset) {
    pendingReset = false;
    doReset();
    return;
  }
  views = s.views || [];
  if (mode === 'flow') {
    if (s.depth < state.stack.length) truncateTo(s.depth);
    else if (s.depth > state.stack.length) { history.go(state.stack.length - s.depth); return; } // 앞으로 가기는 지원 안 함 — 원래 위치로 되돌림
  }
  render();
});

function openView(name) {
  if (views[views.length - 1] === name) return;
  views = [...views, name];
  history.pushState(hs(mode === 'flow' ? state.stack.length : 1), '', location.hash);
  render();
}
function closeViews() {
  if (views.length) history.go(-views.length);
}

// 처음으로: history를 첫 화면까지 되감고 상태 초기화
function goHome() {
  const s = history.state && history.state.app ? history.state : null;
  const n = s ? (s.depth - 1) + (s.views?.length || 0) : 0;
  if (n > 0) {
    pendingReset = true;
    history.go(-n);
    // popstate가 오지 않는 경우 대비
    setTimeout(() => { if (pendingReset) { pendingReset = false; doReset(); } }, 700);
  } else {
    doReset();
  }
}
function doReset() {
  state = freshState();
  views = [];
  mode = 'flow';
  pendingSaved = null;
  save();
  history.replaceState(hs(1, []), '', `#${START_ID}`);
  render();
}

/* ───────── 렌더링 ───────── */
const flowEl = $('#flow');
const viewEl = $('#view');

function render({ keepScroll = false } = {}) {
  const inView = views.length > 0;
  flowEl.hidden = inView;
  viewEl.hidden = !inView;
  if (inView) renderView(views[views.length - 1]);
  else if (mode === 'resume') renderResume();
  else renderFlow();
  updateTopbar();
  if (!keepScroll) {
    window.scrollTo(0, 0);
    const hd = (inView ? viewEl : flowEl).querySelector('h1');
    if (hd) { hd.setAttribute('tabindex', '-1'); hd.focus({ preventScroll: true }); }
  }
}

function updateTopbar() {
  const label = $('#stepLabel');
  let n = '', name = '';
  if (views.length) {
    const v = views[views.length - 1];
    n = '메뉴';
    name = v === 'menu' ? '메뉴' : v === 'about' ? '앱 정보' : PAGES[v]?.title || '';
  } else if (mode === 'resume') {
    n = '저장된 진행';
    name = '이어서 하기';
  } else {
    const nd = node(cur().id);
    n = `${state.stack.length}단계`;
    name = nd.stage;
  }
  label.replaceChildren(
    h('span', { class: 'tb-n' }, n, wakeLock ? h('span', { class: 'tb-wake', title: '화면 켜짐 유지 중' }, '🔆 켜짐 유지') : null),
    h('span', { class: 'tb-name' }, name),
  );
  $('#btnBack').disabled = !(views.length || (mode === 'flow' && state.stack.length > 1));
  $('#btnMenu').disabled = mode === 'resume' || views[views.length - 1] === 'menu';
}

/* 화면 조각들 */
function badgeEl(text, big, asHeading) {
  const m = /^([A-Z])\.\s*(.+)$/.exec(text);
  const tag = asHeading ? 'h1' : 'div';
  return h(tag, { class: `badge${big ? ' big' : ''}` },
    m ? h('span', { class: 'badge-key', 'aria-hidden': 'true' }, m[1]) : null,
    h('span', { class: 'badge-txt' },
      big ? h('span', { class: 'badge-label' }, '판정') : null,
      m ? `${m[1]}. ${m[2]}` : text),
  );
}
function warnEl(text) {
  return h('div', { class: 'warn', role: 'note' },
    h('span', { class: 'warn-ic', 'aria-hidden': 'true' }, '⚠'),
    h('div', {}, h('span', { class: 'warn-t' }, '⚠ 경고'), text),
  );
}
function noteEl(note) {
  return h('details', { class: 'note' },
    h('summary', {}, '💡 부연설명'),
    h('div', { class: 'note-body' }, asList(note).map((t) => h('p', {}, t))),
  );
}
function bodyEl(body) {
  return h('div', { class: 'body' }, asList(body).map((t) => h('p', {}, t)));
}
function tableEl(t) {
  return h('div', { class: 'mtable', role: 'list', 'aria-label': t.cols.join(' · ') },
    t.rows.map((r) => h('div', { class: 'mrow', role: 'listitem' },
      h('div', { class: 'mrow-h' }, h('span', { class: 'mrow-k' }, r[0]), h('span', { class: 'mrow-v' }, `정상 ${r[1]}`)),
      h('p', { class: 'mrow-d' }, r[2]),
    )),
  );
}

// 버튼: kind에 따라 색 + 글자 아이콘(색에만 의존하지 않음)
const KIND_BY_INDEX = ['yes', 'no', 'alt'];
const KIND_ICON = { yes: 'O', no: 'X', alt: '≈', next: '→' };
function optionBtn(opt, i, onPick) {
  const kind = opt.kind || KIND_BY_INDEX[i] || 'alt';
  return h('button', { type: 'button', class: `btn btn-${kind}`, onclick: () => onPick(kind) },
    h('span', { class: 'btn-ic', 'aria-hidden': 'true' }, KIND_ICON[kind]),
    h('span', { class: 'btn-lb' }, opt.label, opt.sub ? h('span', { class: 'btn-sub' }, opt.sub) : null),
  );
}
const ansLabel = (opt) => (opt.sub ? `${opt.label} (${opt.sub})` : opt.label);

/* 측정 입력 */
function parseV(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function measureHint(m) {
  const ln = parseV(m.ln), lpe = parseV(m.lpe), npe = parseV(m.npe);
  if (ln == null || lpe == null || npe == null) return null;
  const hi = (v) => v >= 180 && v <= 250;
  const zero = (v) => v <= 10;
  if (hi(ln) && hi(lpe) && zero(npe)) return 'A 전기 들어옴';
  if (zero(ln) && hi(lpe) && hi(npe)) return m.load ? 'B N선 단선 의심' : 'B N선 단선 의심 (부하 꽂힘 여부 확인)';
  if (zero(ln) && zero(lpe) && zero(npe)) return 'C L선·상류 불량 의심';
  return '값 흔들림·낮음이면 D 의심';
}
function measureEl({ withHint = true, onChange } = {}) {
  const m = state.measure;
  const hint = h('div', { class: 'hint', 'aria-live': 'polite' });
  const upd = () => {
    const t = withHint ? measureHint(m) : null;
    hint.hidden = !t;
    hint.replaceChildren(h('b', {}, `판정 힌트: ${t || ''}`), h('small', {}, '힌트일 뿐입니다. 아래 질문에 직접 답하세요.'));
    onChange?.();
  };
  const field = (key, label) => h('label', { class: 'mfield' },
    h('span', { class: 'mlabel' }, label),
    h('input', {
      type: 'text', inputmode: 'decimal', autocomplete: 'off', enterkeyhint: 'next',
      value: m[key] ?? '', placeholder: '—', 'aria-label': `${label} 전압(V)`,
      oninput: (e) => {
        const clean = e.target.value.replace(/[^0-9.]/g, '');
        if (clean !== e.target.value) e.target.value = clean;
        m[key] = clean; save(); upd();
      },
    }),
    h('span', { class: 'munit' }, 'V'),
  );
  const box = h('div', { class: 'card measure' },
    h('p', { class: 'measure-h' }, '측정값 입력 (선택 · 당직일지에 자동 반영)'),
    field('ln', 'L-N'), field('lpe', 'L-PE'), field('npe', 'N-PE'),
    h('label', { class: 'chk' },
      h('input', { type: 'checkbox', checked: !!m.load, onchange: (e) => { m.load = e.target.checked; save(); upd(); } }),
      h('span', {}, h('span', { class: 'chk-t' }, '부하(PC 등) 꽂혀 있었음')),
    ),
    withHint ? hint : null,
  );
  upd();
  return box;
}

/* 체크리스트 (info: 선택, check: 필수·순서) */
function checksEl(nd, entry, onUpdate) {
  const items = nd.checks;
  const inputs = [];
  const labels = [];
  const sync = () => {
    items.forEach((c, i) => {
      const locked = nd.sequential && i > 0 && !entry.checks[i - 1];
      inputs[i].checked = !!entry.checks[i];
      inputs[i].disabled = locked;
      labels[i].classList.toggle('is-locked', locked);
    });
    onUpdate?.();
  };
  const list = items.map((c, i) => {
    const input = h('input', {
      type: 'checkbox',
      onchange: (e) => {
        entry.checks[i] = e.target.checked;
        // 순서 고정: 앞 항목을 풀면 뒤 항목도 풀린다
        if (nd.sequential && !e.target.checked) for (let j = i + 1; j < items.length; j++) entry.checks[j] = false;
        save(); sync();
      },
    });
    inputs.push(input);
    const lb = h('label', { class: `chk${c.required ? ' req' : ''}` }, input,
      h('span', {}, h('span', { class: 'chk-t' }, c.text), c.detail ? h('span', { class: 'chk-d' }, c.detail) : null));
    labels.push(lb);
    return lb;
  });
  const box = h('div', { class: 'checks' }, nd.checksTitle ? h('p', { class: 'checks-h' }, nd.checksTitle) : null, list);
  sync();
  return box;
}
const allRequiredDone = (nd, entry) => (nd.checks || []).every((c, i) => !c.required || entry.checks[i]);

/* 지금까지 경로 패널 */
function pathItems() {
  return state.stack.slice(0, -1).map((e) => {
    const nd = node(e.id);
    return { q: nd.title || nd.badge, badge: nd.type === 'result' ? (nd.badge || nd.title) : null, ans: e.ans, ak: e.ak, type: nd.type };
  });
}
function pathEl() {
  const items = pathItems();
  return h('details', { class: 'path' },
    h('summary', {}, `🧭 지금까지 경로 (${items.length})`),
    items.length
      ? h('ol', {}, items.map((it) => h('li', {},
        h('span', {}, it.badge ? `판정 ${it.badge}` : it.q),
        it.ans ? h('span', { class: `ans ${it.ak || ''}` }, it.ans) : null)))
      : h('p', { class: 'empty' }, '아직 답한 질문이 없습니다.'),
  );
}

/* 흐름 화면 */
function renderFlow() {
  const entry = cur();
  const nd = node(entry.id);
  if (nd.type === 'record') { flowEl.replaceChildren(renderRecord(nd), pathEl()); return; }

  const parts = [];
  if (nd.type === 'result') {
    const badgeText = nd.badge || nd.title;
    parts.push(badgeEl(badgeText, true, !nd.badge || !nd.title));
    if (nd.badge && nd.title) parts.push(h('h1', { class: 'title' }, nd.title));
  } else {
    if (nd.badge) parts.push(badgeEl(nd.badge, false));
    parts.push(h('h1', { class: 'title' }, nd.title));
  }
  if (nd.sub) parts.push(h('p', { class: 'sub' }, nd.sub));
  if (nd.warn) parts.push(warnEl(nd.warn));
  if (nd.body) parts.push(bodyEl(nd.body));
  if (nd.table) parts.push(tableEl(nd.table));
  if (nd.measure) parts.push(measureEl());

  const actions = h('div', { class: 'actions' });
  let nextBtn = null;
  if (nd.options) {
    nd.options.forEach((o, i) => actions.append(optionBtn(o, i, (kind) => choose(ansLabel(o), kind, o.next))));
  } else {
    const lbl = nd.nextLabel || '다음';
    nextBtn = h('button', { type: 'button', class: 'btn btn-next', onclick: () => choose(nd.type === 'check' ? '완료' : '확인', 'next', nd.next) });
    actions.append(nextBtn);
    const setNext = () => {
      const remain = (nd.checks || []).filter((c, i) => c.required && !entry.checks[i]).length;
      const ready = nd.type !== 'check' || remain === 0;
      nextBtn.disabled = !ready;
      nextBtn.replaceChildren(
        h('span', { class: 'btn-lb' }, ready ? lbl : `남은 필수 항목 ${remain}개`),
        ready ? h('span', { class: 'btn-ic', 'aria-hidden': 'true' }, '→') : null,
      );
    };
    if (nd.checks) parts.push(checksEl(nd, entry, setNext));
    setNext();
  }
  if (nd.options && nd.checks) parts.push(checksEl(nd, entry));
  if (nd.note) parts.push(noteEl(nd.note));
  parts.push(actions);

  flowEl.replaceChildren(h('article', { class: `screen enter t-${nd.type}` }, parts), pathEl());
}

/* 이어서 하기 화면 */
function renderResume() {
  const s = pendingSaved;
  const nd = node(s.stack[s.stack.length - 1].id);
  const when = new Date(s.savedAt || Date.now());
  flowEl.replaceChildren(h('article', { class: 'screen enter' },
    h('h1', { class: 'title' }, '진행 중인 민원이 있습니다'),
    h('div', { class: 'card' }, h('dl', { class: 'kv' },
      h('dt', {}, '현재 화면'), h('dd', {}, `${s.stack.length}단계 · ${nd.title || nd.badge}`),
      h('dt', {}, '마지막 저장'), h('dd', {}, `${fmtDate(when)} ${fmtHM(when)}`),
    )),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn-yes', onclick: resumeContinue },
        h('span', { class: 'btn-ic', 'aria-hidden': 'true' }, '▶'), h('span', { class: 'btn-lb' }, '이어서 하기')),
      h('button', { type: 'button', class: 'btn btn-no', onclick: doReset },
        h('span', { class: 'btn-ic', 'aria-hidden': 'true' }, '↺'), h('span', { class: 'btn-lb' }, '새로 시작', h('span', { class: 'btn-sub' }, '저장된 진행은 지워집니다'))),
    ),
  ));
}
function resumeContinue() {
  state = pendingSaved;
  pendingSaved = null;
  mode = 'flow';
  // 브라우저 뒤로가기도 되도록 history를 다시 쌓는다
  history.replaceState(hs(1, []), '', `#${state.stack[0].id}`);
  for (let i = 1; i < state.stack.length; i++) history.pushState(hs(i + 1, []), '', `#${state.stack[i].id}`);
  render();
}

/* ───────── 당직일지 기록 ───────── */
const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fmtHM = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const toLocalInput = (d) => `${fmtDate(d)}T${fmtHM(d)}`;

function autoVerdict() {
  for (let i = state.stack.length - 1; i >= 0; i--) {
    const nd = node(state.stack[i].id);
    if (nd.verdict) return nd.verdict;
    if (nd.type === 'result') return nd.badge || nd.title;
  }
  return '';
}
function pathLines() {
  const out = [];
  for (const e of state.stack.slice(0, -1)) {
    const nd = node(e.id);
    if (nd.type === 'question' || (nd.options && e.ans)) out.push(`${nd.title} → ${e.ans}`);
    else if (nd.type === 'result') out.push(`판정 ${nd.badge || nd.title}`);
    else if (nd.type === 'check') out.push(`${nd.title} → ${e.ans || '완료'}`);
  }
  return out;
}
function measureText() {
  const m = state.measure;
  if (!m.ln && !m.lpe && !m.npe) return '미측정';
  const v = (x) => (x === '' || x == null ? '-' : x);
  return `L-N ${v(m.ln)}V / L-PE ${v(m.lpe)}V / N-PE ${v(m.npe)}V (${m.load ? '부하 꽂힘' : '부하 없음'})`;
}
function buildLog() {
  const r = state.record;
  const t = r.time ? new Date(r.time) : new Date(state.startedAt);
  const d = isNaN(t) ? new Date() : t;
  const yymmdd = `${String(d.getFullYear()).slice(2)}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  const val = (x) => (x && String(x).trim() ? String(x).trim().replace(/\n+/g, ' / ') : '-');
  const lines = pathLines();
  return [
    `■ ${yymmdd} 전열·전등 민원`,
    `- 접수: ${fmtHM(d)} / 위치: ${val(r.loc)}`,
    `- 증상: ${val(r.symptom)}`,
    '- 확인 과정:',
    ...(lines.length ? lines.map((l) => `  · ${l}`) : ['  · -']),
    `- 측정값: ${measureText()}`,
    `- 판정: ${val(r.verdict ?? autoVerdict())}`,
    `- 원인: ${val(r.cause)}`,
    `- 조치: ${val(r.action)}`,
    `- 복구 후 확인: ${val(r.after)}`,
    `- 입주사 안내: ${r.tenantDone ? '완료' : '미완료'}${r.tenantNote && r.tenantNote.trim() ? ` — ${val(r.tenantNote)}` : ''}`,
  ].join('\n');
}

function renderRecord(nd) {
  const r = state.record;
  if (!r.time) { r.time = toLocalInput(new Date(state.startedAt)); save(); }
  const preview = h('pre', { class: 'preview', 'aria-label': '당직일지 미리보기' });
  const refresh = () => { preview.textContent = buildLog(); };

  const text = (key, label, opts = {}) => h('label', { class: 'field' },
    h('span', {}, label, opts.auto ? h('span', { class: 'auto-tag' }, '자동') : null),
    opts.hint ? h('small', {}, opts.hint) : null,
    h(opts.multi ? 'textarea' : 'input', {
      type: opts.multi ? null : (opts.type || 'text'),
      rows: opts.multi ? 2 : null,
      placeholder: opts.ph || '',
      value: opts.value ?? r[key] ?? '',
      autocomplete: 'off',
      oninput: (e) => { r[key] = e.target.value; save(); refresh(); },
    }),
  );

  const lines = pathLines();
  const view = h('article', { class: 'screen enter t-record' },
    h('h1', { class: 'title' }, nd.title),
    h('p', { class: 'sub' }, '자동으로 채운 칸도 고칠 수 있습니다.'),
    h('div', { class: 'rec' },
      text('time', '접수 시각', { type: 'datetime-local', auto: true }),
      text('loc', '층·위치', { ph: '예: 23F 창가', hint: '층은 23F처럼 F로 적습니다.' }),
      text('symptom', '증상', { multi: true, ph: '예: 같은 줄 PC 여섯 대 불통' }),
      h('div', { class: 'field' },
        h('span', {}, '확인 과정', h('span', { class: 'auto-tag' }, '자동')),
        h('div', { class: 'card' }, lines.length ? h('ol', { style: 'margin:0;padding-left:20px;font-size:16px' }, lines.map((l) => h('li', {}, l))) : h('small', {}, '경로 없음'))),
      h('div', { class: 'field' },
        h('span', {}, '측정값', h('span', { class: 'auto-tag' }, '자동')),
        measureEl({ withHint: false, onChange: () => refresh() })),
      text('verdict', '판정', { auto: true, value: r.verdict ?? autoVerdict() }),
      text('cause', '원인', { multi: true }),
      text('action', '조치', { multi: true }),
      text('after', '복구 후 확인 결과', { multi: true, ph: '예: 전 콘센트 L-N 220V 확인' }),
      text('tenantNote', '입주사 안내 내용', { multi: true }),
      h('label', { class: 'chk' },
        h('input', { type: 'checkbox', checked: !!r.tenantDone, onchange: (e) => { r.tenantDone = e.target.checked; save(); refresh(); } }),
        h('span', {}, h('span', { class: 'chk-t' }, '입주사 안내 완료'),
          h('span', { class: 'chk-d' }, '원인을 쉬운 말로 설명 + 재발 방지(이사·이동 전 연락, 멀티탭 과부하 주의 등) 안내했음'))),
      h('div', { class: 'field' }, h('span', {}, '미리보기'), preview),
    ),
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn-yes', onclick: () => copyLog(preview) },
        h('span', { class: 'btn-ic', 'aria-hidden': 'true' }, '⧉'), h('span', { class: 'btn-lb' }, '당직일지 텍스트 복사')),
      h('button', { type: 'button', class: 'btn btn-alt', onclick: confirmNew },
        h('span', { class: 'btn-ic', 'aria-hidden': 'true' }, '＋'), h('span', { class: 'btn-lb' }, '새 민원 시작')),
    ),
  );
  refresh();
  return view;
}

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* 대체 방식으로 */ }
  try {
    const ta = h('textarea', { readonly: true, style: 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px' });
    ta.value = text;
    document.body.append(ta);
    ta.focus();
    ta.select();
    ta.setSelectionRange(0, text.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch { return false; }
}
async function copyLog(preview) {
  const ok = await copyText(buildLog());
  if (ok) toast('✓ 복사 완료 — 당직일지에 붙여넣으세요');
  else {
    // 마지막 수단: 미리보기를 선택해 둔다
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(preview);
    sel.removeAllRanges();
    sel.addRange(range);
    toast('복사 실패 — 선택된 미리보기를 길게 눌러 복사하세요');
  }
}
async function confirmNew() {
  if (await confirmBox('새 민원을 시작할까요?', '현재 진행과 기록 내용이 지워집니다. 필요하면 먼저 복사하세요.', '예, 새로 시작')) goHome();
}

/* ───────── 메뉴·보기 화면 ───────── */
const MENU = [
  ['checklist', '✅', '출동 체크리스트'],
  ['mistakes', '⚠️', '자주 하는 오판'],
  ['cases', '📋', '사례 풀이'],
  ['equipment', '🔧', '장비 정보'],
  ['points', '⭐', '외울 포인트'],
  ['__new', '↺', '새로 시작'],
  ['about', 'ℹ️', '앱 정보'],
];

function viewShell(title, ...content) {
  return h('article', { class: 'screen enter' },
    h('h1', { class: 'title' }, title),
    ...content,
    h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'btn btn-next btn-small', onclick: closeViews }, '닫고 진행 화면으로')),
  );
}

function renderView(name) {
  const fn = {
    menu: viewMenu, checklist: viewChecklist, mistakes: viewMistakes, cases: viewCases,
    equipment: viewEquipment, points: viewPoints, about: viewAbout,
  }[name] || viewMenu;
  viewEl.replaceChildren(fn());
}

function viewMenu() {
  const theme = store.get(KEY_THEME) || 'auto';
  const seg = h('div', { class: 'seg', role: 'group', 'aria-label': '화면 테마' },
    [['auto', '자동'], ['light', '라이트'], ['dark', '다크']].map(([k, l]) =>
      h('button', { type: 'button', 'aria-pressed': String(theme === k), onclick: () => { setTheme(k); render({ keepScroll: true }); } }, l)));
  const settings = h('div', { class: 'settings' },
    h('div', { class: 'set-row' }, h('span', {}, '화면 테마'), seg),
    wakeSupported ? h('div', { class: 'set-row' },
      h('span', {}, '화면 켜짐 유지', h('small', {}, '측정 중 화면이 꺼지지 않게')),
      h('button', {
        type: 'button', class: 'switch', role: 'switch', 'aria-checked': String(!!wakeLock), 'aria-label': '화면 켜짐 유지',
        onclick: async () => { await setWake(!wakeLock); render({ keepScroll: true }); },
      })) : null,
  );
  return viewShell('메뉴',
    h('p', { class: 'sec-h' }, '설정'), settings,
    h('p', { class: 'sec-h' }, '참고 자료'),
    h('div', { class: 'menu-list' }, MENU.map(([k, ic, label]) =>
      h('button', {
        type: 'button', class: `menu-item${k === '__new' ? ' danger' : ''}`,
        onclick: k === '__new' ? confirmNew : () => openView(k),
      }, h('span', { class: 'mi-ic', 'aria-hidden': 'true' }, ic), label))),
  );
}

function viewChecklist() {
  const pg = PAGES.checklist;
  const saved = store.get(KEY_DISPATCH) || {};
  const prog = h('p', { class: 'progress' });
  const upd = () => { prog.textContent = `${pg.items.filter((_, i) => saved[i]).length} / ${pg.items.length} 완료`; };
  const inputs = [];
  const list = h('div', { class: 'checks' }, pg.items.map((t, i) => {
    const input = h('input', { type: 'checkbox', checked: !!saved[i], onchange: (e) => { saved[i] = e.target.checked; store.set(KEY_DISPATCH, saved); upd(); } });
    inputs.push(input);
    return h('label', { class: 'chk' }, input, h('span', {}, h('span', { class: 'chk-t' }, t)));
  }));
  upd();
  return viewShell(pg.title, prog, list,
    h('button', {
      type: 'button', class: 'btn btn-alt btn-small',
      onclick: async () => {
        if (!(await confirmBox('체크를 모두 지울까요?', null, '예, 초기화'))) return;
        for (const k of Object.keys(saved)) delete saved[k];
        store.set(KEY_DISPATCH, saved);
        inputs.forEach((x) => { x.checked = false; });
        upd();
      },
    }, '초기화'));
}

function viewMistakes() {
  const pg = PAGES.mistakes;
  return viewShell(pg.title, h('div', { class: 'mis' }, pg.items.map((m) =>
    h('div', { class: 'card mis-card' },
      h('div', { class: 'mis-w' }, h('span', { class: 'mis-ic', 'aria-hidden': 'true' }, '✕'), h('span', {}, h('span', { class: 'sr' }, '오판: '), m.wrong)),
      h('div', { class: 'mis-r' }, h('span', { class: 'mis-ic', 'aria-hidden': 'true' }, '✓'), h('span', {}, h('span', { class: 'sr' }, '올바른 판단: '), m.right))))));
}

function viewCases() {
  const pg = PAGES.cases;
  return viewShell(pg.title, pg.items.map((c) =>
    h('section', { class: 'card case' },
      h('div', { class: 'case-h' }, h('span', { class: 'case-no' }, c.no), h('span', { class: 'badge' }, c.branch)),
      h('h2', { class: 'case-title' }, c.title),
      h('dl', {}, c.rows.map(([k, v]) => [h('dt', {}, k), h('dd', {}, v)])))));
}

// 흐름에서 장비 모델명이 나오는 화면을 찾아 함께 보여준다
function usedIn(model) {
  const code = model.split(' ').pop();
  return Object.values(FLOW)
    .filter((n) => JSON.stringify(n).includes(code))
    .map((n) => n.title || n.badge);
}
function viewEquipment() {
  const pg = PAGES.equipment;
  return viewShell(pg.title, pg.items.map((e) => {
    const used = usedIn(e.model);
    return h('section', { class: 'card eq' },
      h('span', { class: 'eq-k' }, e.kind),
      h('span', { class: 'eq-m' }, e.model),
      e.desc ? h('span', {}, e.desc) : null,
      used.length ? h('span', { class: 'eq-u' }, `흐름에서 사용: ${used.join(', ')}`) : null);
  }));
}

function viewPoints() {
  const pg = PAGES.points;
  return viewShell(pg.title, h('ol', { class: 'points' }, pg.items.map((t) => h('li', {}, t))));
}

function viewAbout() {
  const status = h('dd', {}, '확인 중…');
  const ver = h('dd', {}, '-');
  (async () => {
    try {
      const keys = (await caches.keys()).filter((k) => k.startsWith('elec-guide-'));
      ver.textContent = keys.length ? keys[keys.length - 1].replace('elec-guide-', '') : '-';
      status.textContent = keys.length && navigator.serviceWorker?.controller ? '오프라인 사용 가능' : keys.length ? '저장됨 (다시 열면 오프라인 사용 가능)' : '아직 저장 안 됨';
    } catch { status.textContent = '이 브라우저는 오프라인 저장을 지원하지 않음'; }
  })();
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  return viewShell('앱 정보',
    h('div', { class: 'card' }, h('dl', { class: 'kv' },
      h('dt', {}, '앱'), h('dd', {}, '전열·전등 민원 대처'),
      h('dt', {}, '버전'), ver,
      h('dt', {}, '오프라인'), status,
      h('dt', {}, '실행 방식'), h('dd', {}, standalone ? '홈 화면 앱' : '브라우저'),
      h('dt', {}, '흐름 화면'), h('dd', {}, `${Object.keys(FLOW).length}개`),
    )),
    h('div', { class: 'card body' },
      h('p', {}, '민원 접수부터 원인 판정, 복구, 당직일지 기록까지 "예 / 아니오"로 진행하는 현장 보조 가이드입니다.'),
      h('p', {}, '아이폰 Safari에서 공유 버튼 → "홈 화면에 추가"를 누르면 앱처럼 쓸 수 있고, 한 번 열어 두면 신호가 없어도 동작합니다.'),
      h('p', {}, '진행 상태와 기록은 이 기기에만 저장되며 외부로 전송되지 않습니다.')),
    h('p', { class: 'sub' }, FOOTER),
  );
}

/* ───────── 확인창 · 토스트 ───────── */
const modalEl = $('#modal');
let modalResolve = null;
function closeModal(v) {
  if (!modalResolve) return;
  const r = modalResolve;
  modalResolve = null;
  modalEl.hidden = true;
  modalEl.replaceChildren();
  r(v);
}
function confirmBox(title, msg, okLabel = '예', cancelLabel = '아니오') {
  closeModal(false);
  return new Promise((resolve) => {
    modalResolve = resolve;
    const ok = h('button', { type: 'button', class: 'btn btn-yes btn-small', onclick: () => closeModal(true) }, okLabel);
    modalEl.replaceChildren(h('div', { class: 'modal-card', role: 'alertdialog', 'aria-modal': 'true', 'aria-labelledby': 'mTitle' },
      h('h2', { id: 'mTitle' }, title),
      msg ? h('p', {}, msg) : null,
      ok,
      h('button', { type: 'button', class: 'btn btn-alt btn-small', onclick: () => closeModal(false) }, cancelLabel)));
    modalEl.hidden = false;
    ok.focus();
  });
}
modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeModal(false); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(false); });

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

/* ───────── 테마 ───────── */
function setTheme(k) {
  if (k === 'light' || k === 'dark') document.documentElement.dataset.theme = k;
  else delete document.documentElement.dataset.theme;
  store.set(KEY_THEME, k);
}

/* ───────── 화면 켜짐 유지 (Wake Lock) ───────── */
const wakeSupported = 'wakeLock' in navigator;
let wakeLock = null;
let wakeWanted = false;
async function setWake(on) {
  wakeWanted = on;
  if (on) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; updateTopbar(); });
      toast('🔆 화면 켜짐 유지 켬');
    } catch {
      wakeWanted = false;
      wakeLock = null;
      toast('화면 켜짐 유지를 켤 수 없습니다');
    }
  } else {
    try { await wakeLock?.release(); } catch { /* 무시 */ }
    wakeLock = null;
  }
  updateTopbar();
}
// 앱을 다시 보면 자동으로 다시 켠다 (화면이 가려지면 브라우저가 해제함)
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && wakeWanted && !wakeLock) setWake(true);
});

/* ───────── 서비스워커 ───────── */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  let refreshing = false;
  let updateRequested = false;
  // "적용"을 눌러 새 버전이 활성화되면 새로고침 (진행 상태는 저장되어 있음)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !updateRequested) return;
    refreshing = true;
    location.reload();
  });
  const showUpdate = (worker) => {
    $('#updateBar').hidden = false;
    $('#btnUpdate').onclick = () => { updateRequested = true; worker.postMessage('SKIP_WAITING'); };
  };
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    if (reg.waiting && navigator.serviceWorker.controller) showUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdate(w);
      });
    });
  }).catch(() => { /* 파일 직접 열기 등 — 온라인 전용으로 동작 */ });
}

/* ───────── 시작 ───────── */
$('#btnBack').addEventListener('click', goBack);
$('#btnMenu').addEventListener('click', () => openView('menu'));
$('#btnHome').addEventListener('click', async () => {
  if (await confirmBox('처음으로 돌아갈까요?', '지금까지 진행한 내용과 기록이 지워집니다.', '예, 처음으로')) goHome();
});
$('#foot').textContent = FOOTER;

(function init() {
  const saved = loadSaved();
  if (saved && hasProgress(saved)) {
    mode = 'resume';
    pendingSaved = saved;
    history.replaceState(hs(1, []), '', location.pathname + location.search);
  } else {
    state = freshState();
    save();
    history.replaceState(hs(1, []), '', `#${START_ID}`);
  }
  render();
  registerSW();
})();
