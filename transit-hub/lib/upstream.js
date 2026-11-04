// 외부 API 호출. 규칙:
//  - 같은 요청은 10초 캐시, 타임아웃 6초.
//  - 키가 들어간 URL·원본 에러 메시지는 절대 로그/응답으로 내보내지 않는다.
//    UpstreamError 는 고정된 짧은 사유 코드만 담는다.

export const TIMEOUT_MS = 6000;
export const CACHE_TTL_MS = 10_000;

// ── 엔드포인트 ──────────────────────────────────────────────────────────────
// 서울 실시간 지하철 도착정보 — 검증됨(사용자 제공 검색 결과).
const SEOUL_BASE = 'http://swopenAPI.seoul.go.kr/api/subway';

// TODO(unverified): 아래 TAGO 경로·파라미터·필드명은 공식 문서를 직접 열람하지 못한 상태의 "알려진 값"이다.
//   이 세션에서 www.data.go.kr 가 네트워크 정책으로 차단되어 확인하지 못했다.
//   키를 받은 뒤 `npm run find-stop -- --cities` 와 실호출로 검증하고, 다르면 이 상수만 고치면 된다.
export const TAGO_ARRIVAL_URL =
  'http://apis.data.go.kr/1613000/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList';
export const TAGO_STOP_URL = 'http://apis.data.go.kr/1613000/BusSttnInfoInqireService/getSttnNoList';
export const TAGO_CITY_URL = 'http://apis.data.go.kr/1613000/BusSttnInfoInqireService/getCtyCodeList';

export class UpstreamError extends Error {
  constructor(source, reason) {
    super(`${source}:${reason}`);
    this.name = 'UpstreamError';
    this.source = source;
    this.reason = reason; // timeout | network | http_NNN | bad_response | api_CODE | no_key | not_configured
  }
}

/** 공공데이터포털 키: Encoding 키(%포함)를 붙여넣어도 이중 인코딩되지 않게 디코딩 */
export function normalizeServiceKey(key) {
  const k = String(key ?? '').trim();
  if (!k) return '';
  if (/%[0-9A-Fa-f]{2}/.test(k)) {
    try {
      return decodeURIComponent(k);
    } catch {
      return k;
    }
  }
  return k;
}

async function fetchText(source, url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { accept: 'application/json' } });
    if (!res.ok) throw new UpstreamError(source, `http_${res.status}`);
    return await res.text();
  } catch (e) {
    if (e instanceof UpstreamError) throw e;
    throw new UpstreamError(source, e?.name === 'AbortError' ? 'timeout' : 'network'); // 원본 e 는 URL(=키)을 담을 수 있어 버린다
  } finally {
    clearTimeout(timer);
  }
}

// ── 10초 캐시 (isolate 메모리 + Cloudflare Cache API) ───────────────────────
const mem = new Map(); // key -> {at, value}
const inflight = new Map(); // key -> Promise

async function cacheGet(key) {
  const hit = mem.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      const res = await caches.default.match(cacheRequest(key));
      if (res) {
        const value = await res.json();
        mem.set(key, { at: Date.now(), value });
        return value;
      }
    }
  } catch {
    /* 캐시 실패는 무시하고 원본 호출 */
  }
  return undefined;
}

async function cachePut(key, value) {
  mem.set(key, { at: Date.now(), value });
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      await caches.default.put(
        cacheRequest(key),
        new Response(JSON.stringify(value), {
          headers: { 'content-type': 'application/json', 'cache-control': `max-age=${CACHE_TTL_MS / 1000}` },
        }),
      );
    }
  } catch {
    /* ignore */
  }
}

// 캐시 키는 논리 키(역명, nodeId 등)만 쓴다 — API 키는 포함하지 않는다.
const cacheRequest = (key) => new Request(`https://cache.transit-hub.invalid/${encodeURIComponent(key)}`);

export async function cached(key, producer) {
  const hit = await cacheGet(key);
  if (hit !== undefined) return hit;
  if (inflight.has(key)) return inflight.get(key);
  const p = (async () => {
    const value = await producer();
    await cachePut(key, value);
    return value;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

// ── 서울 지하철 ─────────────────────────────────────────────────────────────
/** 역명은 "역" 없이. 반환: realtimeArrivalList 배열(없으면 []) */
export function fetchSeoulArrivals(key, station) {
  if (!key) return Promise.reject(new UpstreamError('seoul', 'no_key'));
  return cached(`seoul:${station}`, async () => {
    const url = `${SEOUL_BASE}/${encodeURIComponent(key)}/json/realtimeStationArrival/0/30/${encodeURIComponent(station)}`;
    const text = await fetchText('seoul', url);
    let body;
    try {
      body = JSON.parse(text);
    } catch {
      throw new UpstreamError('seoul', 'bad_response');
    }
    // 오류 형태: {status, code:"INFO-200"|"ERROR-xxx", message} 또는 errorMessage:{code,...}
    const code = body?.code ?? body?.errorMessage?.code;
    if (code && code !== 'INFO-000') {
      if (code === 'INFO-200') return []; // 해당 데이터 없음
      throw new UpstreamError('seoul', /^[A-Z]+-\d+$/.test(code) ? `api_${code}` : 'api_unknown');
    }
    return Array.isArray(body?.realtimeArrivalList) ? body.realtimeArrivalList : [];
  });
}

// ── TAGO 버스 ───────────────────────────────────────────────────────────────
function tagoUrl(base, key, params) {
  const q = new URLSearchParams({ serviceKey: normalizeServiceKey(key), _type: 'json', ...params });
  return `${base}?${q}`;
}

export function tagoItems(body) {
  const items = body?.response?.body?.items;
  let list = items && typeof items === 'object' ? items.item : [];
  if (list == null || list === '') list = [];
  return Array.isArray(list) ? list : [list];
}

export async function tagoRequest(source, base, key, params) {
  if (!key) throw new UpstreamError(source, 'no_key');
  const text = await fetchText(source, tagoUrl(base, key, params));
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    // 인증 오류 등은 _type=json 이어도 XML 로 올 수 있다. 숫자 사유 코드만 꺼낸다.
    const code = text.match(/<returnReasonCode>\s*(\d{1,3})\s*</)?.[1];
    throw new UpstreamError(source, code ? `api_${code}` : 'bad_response');
  }
  const rc = body?.response?.header?.resultCode;
  if (rc != null && String(rc) !== '00' && String(rc) !== '0') {
    throw new UpstreamError(source, /^\d{1,3}$/.test(String(rc)) ? `api_${rc}` : 'api_unknown');
  }
  return body;
}

/** 반환: [{route, seconds, stopsLeft}] (정규화 전) */
export function fetchBusArrivals(key, { cityCode, nodeId }) {
  if (!key) return Promise.reject(new UpstreamError('tago', 'no_key'));
  return cached(`tago:${cityCode}:${nodeId}`, async () => {
    const body = await tagoRequest('tago', TAGO_ARRIVAL_URL, key, {
      cityCode: String(cityCode),
      nodeId: String(nodeId),
      pageNo: '1',
      numOfRows: '50',
    });
    // TODO(unverified): 필드명 arrtime(초) / arrprevstationcnt(남은 정거장) / routeno — 문서 미확인. 대소문자 변형도 허용.
    return tagoItems(body).map((it) => ({
      route: it.routeno ?? it.routeNo ?? it.routenm,
      seconds: Number(it.arrtime ?? it.arrTime),
      stopsLeft: it.arrprevstationcnt ?? it.arrPrevStationCnt ?? null,
    }));
  });
}

/** 사용자에게 보여줄 한국어 경고 문구 (키·URL 없음) */
export function describeError(label, err) {
  const r = err instanceof UpstreamError ? err.reason : 'unknown';
  if (r === 'timeout') return `${label}: 응답 시간 초과(6초)`;
  if (r === 'network') return `${label}: 연결 실패`;
  if (r === 'no_key') return `${label}: 인증키 없음`;
  if (r === 'not_configured') return `${label}: 설정 미완료`;
  if (r === 'bad_response') return `${label}: 응답 형식 오류`;
  if (r.startsWith('http_')) return `${label}: HTTP 오류 ${r.slice(5)}`;
  if (r.startsWith('api_')) return `${label}: API 오류 ${r.slice(4)}`;
  return `${label}: 알 수 없는 오류`;
}
