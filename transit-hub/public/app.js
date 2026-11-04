(() => {
  'use strict';

  const LS_KEY = 'transit-hub:route';
  const REQUEST_TIMEOUT_MS = 10000;
  const STALE_AFTER_SEC = 75; // 마지막 성공 조회가 이보다 오래되면 흐리게

  const $ = (id) => document.getElementById(id);
  const el = {
    main: $('main'), tabs: $('tabs'), badge: $('badge'), notice: $('notice'),
    swBig: $('sw-big'), swLine: $('sw-line'), swNext: $('sw-next'), swTitle: $('sw-title'),
    exTitle: $('ex-title'), exBig: $('ex-big'), exLine: $('ex-line'),
    busCard: $('bus-card'), busTitle: $('bus-title'), busPlan: $('bus-plan'), busRows: $('bus-rows'),
    refresh: $('refresh'), asof: $('asof'),
  };

  const store = {
    get() { try { return localStorage.getItem(LS_KEY); } catch { return null; } },
    set(v) { try { localStorage.setItem(LS_KEY, v); } catch { /* 저장 불가 환경 */ } },
    del() { try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ } },
  };

  let routeId = store.get() || '';
  let data = null;        // 마지막 서버 응답
  let gotAt = 0;          // 응답을 받은 시각(performance.now)
  let catchIdx = -1;
  let ctrl = null;        // 진행 중 요청
  let lastError = '';
  let timer = null;       // 자동 재조회

  const elapsed = () => (data ? (performance.now() - gotAt) / 1000 : 0);
  const left = (sec) => (sec == null ? null : Math.max(0, sec - elapsed()));

  const clockFmt = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const hhmmss = (ms) => clockFmt.format(new Date(ms)).replace(/\s/g, '');

  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  // ── 조회 ──────────────────────────────────────────────────────────────────
  async function load() {
    if (ctrl) ctrl.abort();
    const mine = (ctrl = new AbortController());
    const to = setTimeout(() => mine.abort(), REQUEST_TIMEOUT_MS);
    el.refresh.setAttribute('aria-busy', 'true');
    try {
      const q = routeId ? `?route=${encodeURIComponent(routeId)}` : '';
      const res = await fetch(`/api/dash${q}`, { cache: 'no-store', signal: mine.signal });
      if (res.status === 404 && routeId) { routeId = ''; store.del(); clearTimeout(to); return load(); }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (mine !== ctrl) return; // 더 새로운 요청이 있음
      data = json;
      gotAt = performance.now();
      routeId = json.route.id;
      store.set(routeId);
      lastError = '';
      catchIdx = json.plan && json.bus
        ? json.bus.arrivals.findIndex((a) => a.route === json.plan.catchableRoute && a.seconds === json.plan.catchableSeconds)
        : -1;
      renderStatic();
      schedule(json.refreshSeconds);
    } catch (e) {
      if (mine !== ctrl) return;
      lastError = e?.name === 'AbortError' ? '응답 시간 초과' : '연결 실패';
    } finally {
      clearTimeout(to);
      if (mine === ctrl) { el.refresh.removeAttribute('aria-busy'); el.main.removeAttribute('aria-busy'); }
      render();
    }
  }

  function schedule(sec) {
    clearTimeout(timer);
    timer = setTimeout(load, Math.max(5, sec || 20) * 1000);
  }

  // ── 데이터가 바뀔 때 한 번 그리는 부분 ─────────────────────────────────────
  function renderStatic() {
    const d = data;
    el.badge.hidden = d.mode !== 'MOCK';

    el.tabs.replaceChildren(...d.routes.map((r) => {
      const b = h('button', 'tab', r.label);
      b.type = 'button';
      b.dataset.id = r.id;
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(r.id === d.route.id));
      b.addEventListener('click', () => switchRoute(r.id));
      return b;
    }));

    const sw = d.subway;
    el.swTitle.textContent = `${sw.station}역 ${sw.lineName} · ${sw.toward}방면`;

    const ex = d.exit;
    el.exTitle.textContent = `${ex.station}역에서 내릴 때`;
    el.exBig.replaceChildren(h('span', 'num', ex.found ? `${ex.car}-${ex.door}` : '–'));
    el.exLine.replaceChildren();
    if (ex.found) {
      el.exLine.append(`${ex.car}번째 칸 ${ex.door}번 문${ex.goal ? ` · ${ex.goal}` : ''}`);
      if (!ex.verified) el.exLine.append(h('span', 'tag', '예시'));
      if (ex.note) el.exLine.append(h('div', 'next', ex.note));
    } else {
      el.exLine.append('빠른하차 정보 없음 (data/fast-exit.json 에 추가)');
    }

    el.busCard.hidden = !d.bus;
    if (!d.bus) { el.busPlan.textContent = ''; el.busRows.replaceChildren(); } // 이전 경로의 버스 행이 남지 않게
    if (d.bus) el.busTitle.textContent = /정류장$/.test(d.bus.stopName) ? d.bus.stopName : `${d.bus.stopName} 정류장`;

    el.notice.hidden = false;
    renderNotice();
  }

  function renderNotice() {
    const msgs = [...(data?.warnings || [])];
    if (lastError) msgs.unshift(`새로고침 실패(${lastError}) — 이전 데이터 표시 중`);
    el.notice.replaceChildren(...msgs.map((m) => h('div', null, `⚠ ${m}`)));
    el.notice.hidden = msgs.length === 0;
  }

  // ── 1초마다 갱신되는 부분 ─────────────────────────────────────────────────
  function fmtBig(sec) {
    if (sec <= 10) return { num: '곧', unit: '', sub: '' };
    if (sec < 60) return { num: String(Math.floor(sec)), unit: '초', sub: '' };
    return { num: String(Math.floor(sec / 60)), unit: '분', sub: `${Math.floor(sec % 60)}초` };
  }
  const after = (sec) => (sec < 60 ? '1분 미만' : `${Math.floor(sec / 60)}분 후`);

  function render() {
    renderNotice();
    const stale = !data || elapsed() > STALE_AFTER_SEC;
    el.main.classList.toggle('stale', !!data && stale);
    el.asof.classList.toggle('stale', !!data && stale);
    el.asof.textContent = data ? `${hhmmss(data.generatedAt)} 기준${stale ? ' (오래됨)' : ''}` : (lastError ? `조회 실패: ${lastError}` : '불러오는 중…');
    if (!data) { if (lastError) el.swLine.textContent = `조회 실패: ${lastError}. 아래 버튼으로 다시 시도`; return; }

    // 지하철
    const trains = data.subway.trains;
    if (!trains.length) {
      el.swBig.className = 'big';
      el.swBig.replaceChildren(h('span', 'num', '–'));
      el.swLine.textContent = '도착 정보 없음';
      el.swNext.textContent = '';
    } else {
      const t = trains[0];
      const sec = left(t.seconds);
      const b = fmtBig(sec);
      el.swBig.className = `big${b.num === '곧' ? ' soon' : ''}`;
      el.swBig.replaceChildren(h('span', 'num', b.num), ...(b.unit ? [h('span', 'unit', b.unit)] : []));
      const parts = [];
      if (b.sub) parts.push(b.sub);
      else if (b.num === '곧' && t.msg) parts.push(t.msg.replace(/\s*\(.*\)$/, ''));
      if (t.dest) parts.push(`${t.dest}행`);
      if (t.express) parts.push('급행');
      if (t.lastTrain) parts.push('막차');
      el.swLine.textContent = parts.join(' · ');
      const rest = trains.slice(1).map((x) => after(left(x.seconds)));
      el.swNext.textContent = rest.length ? `다음 열차 ${rest.join(' · ')}` : '';
    }

    // 버스
    if (data.bus) renderBus();
  }

  function renderBus() {
    const { bus, plan } = data;
    if (plan) {
      const arrive = left(plan.arriveAtStopSec);
      el.busPlan.textContent = `지금 열차를 타면 약 ${Math.max(0, Math.round(arrive / 60))}분 뒤 정류장 도착(승차 ${data.rideMinutes}분 + 도보 ${data.walkMinutes ?? 0}분 기준)`;
    } else {
      el.busPlan.textContent = '열차 정보가 없어 도착 시각을 계산하지 못했어요';
    }

    const real = bus.arrivals.filter((a) => a.seconds != null);
    const none = bus.arrivals.filter((a) => a.seconds == null);
    const cap = Math.max(3, 5 - none.length);
    let start = 0;
    if (catchIdx >= 0) start = Math.max(0, catchIdx - 2);
    else if (plan) start = Math.max(0, real.length - 2); // 놓친 버스만 있음
    const view = real.slice(start, start + cap);

    const rows = view.map((a, i) => {
      const idx = start + i;
      const cls = catchIdx >= 0 ? (idx < catchIdx ? 'missed' : idx === catchIdx ? 'catch' : '') : (plan ? 'missed' : '');
      const li = h('li', `row ${cls}`.trim());
      li.append(h('div', 'rt', a.route));
      const mid = h('div', 'mid', a.stopsLeft != null ? `${a.stopsLeft}정거장 전` : '');
      if (cls === 'catch') mid.prepend(h('b', null, '이거 탄다'));
      li.append(mid);
      const s = left(a.seconds);
      const eta = h('div', 'eta');
      if (s <= 10) eta.textContent = '곧';
      else if (s < 60) eta.append(String(Math.floor(s)), h('small', null, '초'));
      else eta.append(String(Math.floor(s / 60)), h('small', null, '분'));
      li.append(eta);
      return li;
    });
    for (const a of none) {
      const li = h('li', 'row none');
      li.append(h('div', 'rt', a.route), h('div', 'mid', '정보 없음(회차 대기 가능)'));
      rows.push(li);
    }
    if (plan && catchIdx < 0 && real.length) rows.push(h('li', 'none-msg', '이 열차에 맞는 버스 정보가 아직 없어요'));
    el.busRows.replaceChildren(...rows);
  }

  // ── 조작 ──────────────────────────────────────────────────────────────────
  function switchRoute(id) {
    if (id === routeId && data) return;
    routeId = id;
    store.set(id);
    data = null; // 다른 경로의 낡은 값을 보여주지 않는다
    el.swBig.className = 'big';
    el.swBig.replaceChildren(h('span', 'num', '–'));
    el.swLine.textContent = '불러오는 중…';
    el.swNext.textContent = '';
    el.exBig.replaceChildren(h('span', 'num', '–'));
    el.exLine.textContent = '';
    el.busCard.hidden = true;
    el.main.classList.remove('stale');
    el.tabs.querySelectorAll('.tab').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === id)));
    load();
  }

  el.refresh.addEventListener('click', load);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
  window.addEventListener('pageshow', (e) => { if (e.persisted) load(); }); // iOS 홈 화면 앱 복귀

  setInterval(() => { if (document.visibilityState === 'visible') render(); }, 1000);
  load();
})();
