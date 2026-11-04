// 모의 데이터 — 실제 API 응답과 "같은 모양"으로 만들어 compute.js 파이프라인을 그대로 통과시킨다.
// 시계에서 파생하므로 새로고침할 때마다 시각에 맞게 줄어드는 값이 나온다.

const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.codePointAt(0)) >>> 0, 7);

// 열차가 향하는 종착(모의): 방면 → 행선지
const DEST = { 구파발: '대화', 삼송: '오금', 원당: '대화', 불광: '오금' };

/** 서울 realtimeArrivalList 모양 (노이즈로 반대 방향·다른 노선 포함) */
export function mockSeoulList(now, route) {
  const sw = route.subway;
  const period = 270;
  const t = Math.floor(now / 1000);
  const off = hash(route.id) % period;
  const first = period - ((t + off) % period);
  const mk = (sec, toward, dest, lineId = sw.lineId) => ({
    subwayId: lineId,
    trainLineNm: `${dest}행 - ${toward}방면`,
    bstatnNm: dest,
    barvlDt: String(sec),
    arvlMsg2: sec < 30 ? '전역 도착' : `${Math.floor(sec / 60)}분 ${sec % 60}초 후 (구파발)`,
    arvlMsg3: '구파발',
    btrainSttus: '일반',
    lstcarAt: '0',
    recptnDt: new Date(now).toISOString(),
  });
  const dest = DEST[sw.toward] ?? sw.toward;
  const mine = [0, 1, 2, 3].map((i) => mk(first + i * period + (i % 2) * 17, sw.toward, dest));
  const opposite = mk(95 + (t % 120), '대화', '오금');
  const otherLine = mk(180 + (t % 100), '봉화산', '응암', '1006');
  return [opposite, ...mine, otherLine];
}

const MOCK_BUS = [
  { route: '24A', period: 14 * 60 }, // 24B 는 일부러 비워 "정보 없음(회차 대기)" 표시를 확인한다
  { route: '075B', period: 9 * 60 },
  { route: '730', period: 13 * 60 },
  { route: '95', period: 11 * 60 },
];

/** 정규화 전 버스 항목 [{route, seconds, stopsLeft}] — 노선당 다음 2대 */
export function mockBusItems(now) {
  const t = Math.floor(now / 1000);
  const out = [];
  for (const { route, period } of MOCK_BUS) {
    const first = period - ((t + (hash(route) % period)) % period);
    for (const sec of [first, first + period]) {
      out.push({ route, seconds: sec, stopsLeft: Math.max(1, Math.ceil(sec / 150)) });
    }
  }
  return out;
}
