import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computePlan, lookupExit, normalizeBus, parseArrivalSeconds, pickTrains } from '../lib/compute.js';
import { normalizeServiceKey, tagoItems } from '../lib/upstream.js';
import { buildDash, resolveMode } from '../lib/dash.js';
import routes from './fixtures/routes.js';

test('parseArrivalSeconds: barvlDt 우선, 없으면 arvlMsg2 파싱, 상태 메시지는 0', () => {
  assert.equal(parseArrivalSeconds({ barvlDt: '24', arvlMsg2: '3분 20초 후' }), 24);
  assert.equal(parseArrivalSeconds({ barvlDt: '0', arvlMsg2: '3분 20초 후 (구파발)' }), 200);
  assert.equal(parseArrivalSeconds({ barvlDt: '0', arvlMsg2: '5분 후' }), 300);
  assert.equal(parseArrivalSeconds({ barvlDt: '0', arvlMsg2: '45초 후' }), 45);
  assert.equal(parseArrivalSeconds({ barvlDt: '0', arvlMsg2: '전역 도착' }), 0);
  assert.equal(parseArrivalSeconds({ arvlMsg2: '진입' }), 0);
  assert.equal(parseArrivalSeconds({ barvlDt: '0', arvlMsg2: '[3]번째 전역' }), 360); // 추정값
});

const L = (o) => ({ subwayId: '1003', trainLineNm: '오금행 - 삼송방면', bstatnNm: '오금', barvlDt: '100', arvlMsg2: '', ...o });

test('pickTrains: 노선·방면 필터, 가까운 순 3개, 접미 일치 방지', () => {
  const list = [
    L({ barvlDt: '500' }),
    L({ barvlDt: '60' }),
    L({ barvlDt: '300' }),
    L({ barvlDt: '700' }),
    L({ barvlDt: '10', trainLineNm: '대화행 - 구파발방면' }), // 반대 방향
    L({ barvlDt: '20', subwayId: '1006' }), // 다른 노선
    L({ barvlDt: '30', trainLineNm: '오금행 - 남삼송방면' }), // 이름 끝만 겹침
  ];
  const t = pickTrains(list, { lineId: '1003', toward: '삼송' });
  assert.deepEqual(t.map((x) => x.seconds), [60, 300, 500]);
  assert.equal(t[0].dest, '오금');
});

test('computePlan: 정류장 도착 = 첫 열차 + 승차 + 도보, 30초 여유 경계 포함', () => {
  const arrivals = [
    { route: '730', seconds: 100, stopsLeft: 1 },
    { route: '24A', seconds: 870, stopsLeft: 3 }, // 도착 900-30 = 870 → 탈 수 있음(경계 포함)
    { route: '95', seconds: 1200, stopsLeft: 6 },
  ];
  // 60 + 10*60 + 5*60 = 960 → 기준 930 → 1200 의 95
  const p1 = computePlan({ firstTrainSec: 60, rideMinutes: 10, walkMinutes: 5, arrivals });
  assert.equal(p1.arriveAtStopSec, 960);
  assert.equal(p1.catchableRoute, '95');
  // 0 + 600 + 300 = 900 → 기준 870 → 24A
  const p2 = computePlan({ firstTrainSec: 0, rideMinutes: 10, walkMinutes: 5, arrivals });
  assert.deepEqual([p2.catchableRoute, p2.catchableSeconds], ['24A', 870]);
  const p3 = computePlan({ firstTrainSec: 0, rideMinutes: 10, walkMinutes: 5, arrivals: [{ route: 'X', seconds: 869 }] });
  assert.equal(p3.catchableRoute, null);
});

test('normalizeBus: 관심 노선만, 빈 노선은 정보 없음(seconds:null) 행, 정보 없음 행은 탈 수 있음 후보에서 제외', () => {
  const rows = normalizeBus(
    [
      { route: '730', seconds: 400, stopsLeft: 2 },
      { route: '999', seconds: 50, stopsLeft: 1 }, // 관심 아님
      { route: '24a', seconds: 200, stopsLeft: 1 },
    ],
    ['24A', '24B', '730'],
  );
  assert.deepEqual(rows.map((r) => r.route), ['24a', '730', '24B']);
  assert.equal(rows.at(-1).seconds, null);
  assert.equal(computePlan({ firstTrainSec: 0, rideMinutes: 0, walkMinutes: 0, arrivals: [{ route: '24B', seconds: null }] }).catchableRoute, null);
});

test('lookupExit: 방향이 다르면 대체하지 않는다', () => {
  const entries = [{ station: '원흥', lineId: '1003', toward: '원당', goal: '버스 환승', car: 6, door: 3, side: '왼쪽', verified: false }];
  const hit = lookupExit(entries, { station: '원흥', lineId: '1003', toward: '원당', goal: '버스 환승' });
  assert.deepEqual([hit.found, hit.car, hit.door, hit.side, hit.verified], [true, 6, 3, '왼쪽', false]);
  assert.equal(lookupExit(entries, { station: '원흥', lineId: '1003', toward: '삼송', goal: '버스 환승' }).found, false);
});

test('normalizeServiceKey / tagoItems', () => {
  assert.equal(normalizeServiceKey('ab%2Bc%3D'), 'ab+c=');
  assert.equal(normalizeServiceKey('ab+c='), 'ab+c=');
  assert.deepEqual(tagoItems({ response: { body: { items: '' } } }), []);
  assert.deepEqual(tagoItems({ response: { body: { items: { item: { a: 1 } } } } }), [{ a: 1 }]);
  assert.deepEqual(tagoItems({ response: { body: { items: { item: [{ a: 1 }, { a: 2 }] } } } }).length, 2);
});

test('buildDash(MOCK): 응답 모양과 환승 계산', async () => {
  assert.equal(resolveMode({}), 'MOCK');
  assert.equal(resolveMode({ SEOUL_API_KEY: 'x', MOCK: '1' }), 'MOCK');
  assert.equal(resolveMode({ SEOUL_API_KEY: 'x' }), 'LIVE');
  const fastExit = { entries: [{ station: '원흥', lineId: '1003', toward: '원당', goal: '버스 환승', car: 6, door: 3, verified: false }] };
  for (const route of routes) {
    const d = await buildDash({ route, routes, fastExit, env: {}, now: 1_700_000_000_000 });
    assert.equal(d.mode, 'MOCK');
    assert.equal(d.subway.trains.length, 3);
    assert.ok(d.subway.trains.every((t, i, a) => i === 0 || a[i - 1].seconds <= t.seconds));
    if (route.bus) {
      assert.ok(d.plan.arriveAtStopSec >= d.subway.trains[0].seconds + 900);
      const hit = d.bus.arrivals.find((a) => a.route === d.plan.catchableRoute && a.seconds === d.plan.catchableSeconds);
      assert.ok(hit && hit.seconds >= d.plan.arriveAtStopSec - 30);
      assert.ok(d.bus.arrivals.some((a) => a.seconds === null), '24B 정보 없음 행');
    } else {
      assert.equal(d.bus, null);
      assert.equal(d.plan, null);
    }
  }
});

test('buildDash(LIVE): 키 없음/미설정 nodeId 는 경고로 처리하고 나머지는 계속', async () => {
  const d = await buildDash({ route: routes[0], routes, fastExit: { entries: [] }, env: { DATA_GO_KR_KEY: 'k' }, now: 0 });
  assert.equal(d.mode, 'LIVE');
  assert.ok(d.warnings.some((w) => w.includes('서울 지하철') && w.includes('인증키 없음')));
  assert.ok(d.warnings.some((w) => w.includes('nodeId')));
  assert.ok(!JSON.stringify(d).includes('"k"'));
});
