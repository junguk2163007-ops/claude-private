// 순수 계산 로직 — fetch/환경에 의존하지 않아 node --test 로 검증한다.

// "[N]번째 전역" 처럼 초 정보가 전혀 없을 때만 쓰는 거친 추정(역간 약 2분).
// 명세는 이 경우 0("곧")으로 두라고 하지만, 3정거장 전 열차를 "곧"으로 보여주면 오판을 부르므로 추정값을 쓴다.
export const STOP_ESTIMATE_SEC = 120;

/** 서울 지하철 arrival 항목 → 도착까지 남은 초 */
export function parseArrivalSeconds(item) {
  const b = Number(item?.barvlDt);
  if (Number.isFinite(b) && b > 0) return Math.round(b);

  const msg = String(item?.arvlMsg2 ?? '');
  const m = msg.match(/(\d+)\s*분(?:\s*(\d+)\s*초)?/);
  if (m) return Number(m[1]) * 60 + Number(m[2] || 0);
  const s = msg.match(/(\d+)\s*초/);
  if (s) return Number(s[1]);
  const n = msg.match(/\[?(\d+)\]?\s*번째\s*전역/);
  if (n) return Number(n[1]) * STOP_ESTIMATE_SEC;
  return 0; // 진입/도착/출발 같은 상태 메시지
}

const escapeRe = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** subwayId 일치 + trainLineNm 에 "<toward>방면" 포함, 가까운 순 limit 개 */
export function pickTrains(list, { lineId, toward }, limit = 3) {
  const re = new RegExp(`(^|[\\s-])${escapeRe(toward)}방면`);
  return (Array.isArray(list) ? list : [])
    .filter((x) => String(x?.subwayId) === String(lineId) && re.test(String(x?.trainLineNm ?? '')))
    .map((x) => ({
      seconds: parseArrivalSeconds(x),
      dest: String(x.bstatnNm ?? ''),
      msg: String(x.arvlMsg2 ?? ''),
      where: String(x.arvlMsg3 ?? ''),
      express: /급행/.test(String(x.btrainSttus ?? '')),
      lastTrain: String(x.lstcarAt) === '1',
    }))
    .sort((a, b) => a.seconds - b.seconds)
    .slice(0, limit);
}

const routeKey = (r) => String(r ?? '').trim().toUpperCase();

/**
 * 버스 도착 목록 정규화. items: [{route, seconds, stopsLeft}]
 * watchRoutes 가 있으면 그 노선만 남기고, 도착정보가 없는 관심 노선은 seconds:null 행으로 뒤에 붙인다
 * ("정보 없음(회차 대기 가능)").
 */
export function normalizeBus(items, watchRoutes = []) {
  const watch = (watchRoutes ?? []).map(routeKey);
  let rows = (items ?? [])
    .map((x) => ({ route: String(x.route).trim(), seconds: Number(x.seconds), stopsLeft: x.stopsLeft == null ? null : Number(x.stopsLeft) }))
    .filter((x) => x.route && Number.isFinite(x.seconds) && x.seconds >= 0);
  if (watch.length) rows = rows.filter((x) => watch.includes(routeKey(x.route)));
  rows.sort((a, b) => a.seconds - b.seconds);

  const seen = new Set(rows.map((r) => routeKey(r.route)));
  const missing = (watchRoutes ?? []).filter((w) => !seen.has(routeKey(w)));
  return [...rows, ...missing.map((route) => ({ route, seconds: null, stopsLeft: null }))];
}

export const CATCH_MARGIN_SEC = 30;

/** 첫 열차를 탔을 때 정류장 도착 시각과 그때 탈 수 있는 첫 버스 */
export function computePlan({ firstTrainSec, rideMinutes, walkMinutes, arrivals }) {
  const arriveAtStopSec = firstTrainSec + rideMinutes * 60 + (walkMinutes ?? 0) * 60;
  const hit = [...(arrivals ?? [])]
    .filter((a) => Number.isFinite(a.seconds))
    .sort((a, b) => a.seconds - b.seconds)
    .find((a) => a.seconds >= arriveAtStopSec - CATCH_MARGIN_SEC);
  return {
    arriveAtStopSec,
    catchableRoute: hit ? hit.route : null,
    catchableSeconds: hit ? hit.seconds : null,
  };
}

/** 빠른하차 로컬 데이터 조회. 방향(toward)이 다른 항목은 절대 대체로 쓰지 않는다(문 위치가 반대일 수 있음). */
export function lookupExit(entries, ex) {
  const base = { station: ex.station, goal: ex.goal ?? '' };
  const same = (entries ?? []).filter(
    (e) => e.station === ex.station && String(e.lineId) === String(ex.lineId) && e.toward === ex.toward,
  );
  const hit = same.find((e) => e.goal === ex.goal) ?? same[0];
  if (!hit) return { ...base, found: false, car: null, door: null, side: null, note: '', verified: false, source: 'none' };
  return {
    ...base,
    found: true,
    car: hit.car,
    door: hit.door,
    side: hit.side ?? null,
    note: hit.note ?? '',
    verified: hit.verified === true,
    source: 'local',
  };
}
