import { computePlan, lookupExit, normalizeBus, pickTrains } from './compute.js';
import { describeError, fetchBusArrivals, fetchSeoulArrivals, UpstreamError } from './upstream.js';
import { mockBusItems, mockSeoulList } from './mock.js';

export const REFRESH_SECONDS = 20;

/** 키가 하나도 없거나 MOCK=1 이면 모의 모드. 키가 일부만 있으면 LIVE 로 두고 없는 쪽은 경고로 처리한다. */
export function resolveMode(env) {
  const mock = String(env?.MOCK ?? '') === '1' || (!env?.SEOUL_API_KEY && !env?.DATA_GO_KR_KEY);
  return mock ? 'MOCK' : 'LIVE';
}

export async function buildDash({ route, routes, fastExit, env = {}, now = Date.now() }) {
  const mode = resolveMode(env);
  const warnings = [];
  const sw = route.subway;
  const ex = route.exit;
  const walkMinutes = ex.walkMinutesToBusStop ?? null;

  // 지하철 / 버스는 서로 독립 — 한쪽이 실패해도 나머지는 보여준다.
  const subwayP =
    mode === 'MOCK' ? Promise.resolve(mockSeoulList(now, route)) : fetchSeoulArrivals(env.SEOUL_API_KEY, sw.station);

  const busCfg = route.bus;
  const nodeReady = busCfg && busCfg.nodeId && busCfg.nodeId !== 'TODO';
  let busP = null;
  if (busCfg) {
    if (mode === 'MOCK') busP = Promise.resolve(mockBusItems(now));
    else if (!nodeReady) busP = Promise.reject(new UpstreamError('tago', 'not_configured'));
    else busP = fetchBusArrivals(env.DATA_GO_KR_KEY, busCfg);
  }

  const [subwayR, busR] = await Promise.allSettled([subwayP, busP ?? Promise.resolve(null)]);

  // 지하철
  let trains = [];
  if (subwayR.status === 'fulfilled') {
    trains = pickTrains(subwayR.value, sw);
    if (!trains.length) {
      warnings.push(
        subwayR.value.length
          ? `${sw.station}역 ${sw.lineName} ${sw.toward}방면 열차가 응답에 없음(노선/방면 설정 확인)`
          : `${sw.station}역 도착정보 없음(운행 종료이거나 API 가 이 역을 제공하지 않을 수 있음)`,
      );
    }
  } else {
    warnings.push(describeError('서울 지하철', subwayR.reason));
  }

  // 버스
  let bus = null;
  if (busCfg) {
    let arrivals = [];
    if (busR.status === 'fulfilled') {
      arrivals = normalizeBus(busR.value, busCfg.watchRoutes);
    } else {
      const label = busR.reason?.reason === 'not_configured' ? '버스 nodeId 미설정(config.json, find-stop 으로 확인)' : null;
      warnings.push(label ?? describeError('버스', busR.reason));
      // 조회 실패 시에는 "정보 없음" 행도 만들지 않는다(경고만 표시).
    }
    bus = { stopName: busCfg.stopName, arrivals };
  }

  // 환승 계획
  let plan = null;
  if (bus) {
    if (trains.length) {
      plan = computePlan({
        firstTrainSec: trains[0].seconds,
        rideMinutes: sw.rideMinutes,
        walkMinutes,
        arrivals: bus.arrivals,
      });
    } else {
      warnings.push('열차 정보가 없어 버스 환승 계산을 건너뜀');
    }
  }

  return {
    generatedAt: now,
    mode,
    refreshSeconds: REFRESH_SECONDS,
    route: { id: route.id, label: route.label },
    routes: routes.map((r) => ({ id: r.id, label: r.label })),
    rideMinutes: sw.rideMinutes,
    walkMinutes,
    subway: { station: sw.station, lineName: sw.lineName, toward: sw.toward, trains },
    // TODO(unverified): 서울교통공사 빠른하차정보 API(data.go.kr 15143840) 연동 — 요청 URL·응답 필드·코레일 구간(원흥 등) 포함 여부
    //   미확인이라 로컬 data/fast-exit.json 만 쓴다. 확인되면 여기서 API 우선 → 로컬 폴백 순으로 합친다.
    exit: lookupExit(fastExit.entries, { ...ex }),
    bus,
    plan,
    warnings,
  };
}
