#!/usr/bin/env node
// 서울 지하철 API 가 해당 역을 어떻게 내려주는지 확인 (원흥 등 코레일 구간 포함 여부 검증용)
//   node scripts/probe-subway.js 원흥
// subwayId / trainLineNm 조합을 나열한다 → config.json 의 lineId·toward 설정에 그대로 쓴다.
import { loadVar } from './_env.js';
import { UpstreamError, describeError, fetchSeoulArrivals } from '../lib/upstream.js';

const station = process.argv[2];
if (!station) {
  console.error('사용법: node scripts/probe-subway.js <역명(역 제외)>');
  process.exit(2);
}
try {
  const list = await fetchSeoulArrivals(loadVar('SEOUL_API_KEY'), station);
  if (!list.length) {
    console.log(`"${station}" 도착정보 없음 — 운행 종료이거나 API 가 이 역을 제공하지 않을 수 있습니다.`);
  } else {
    const seen = new Map();
    for (const x of list) seen.set(`${x.subwayId}\t${x.trainLineNm}`, (seen.get(`${x.subwayId}\t${x.trainLineNm}`) ?? 0) + 1);
    console.log('subwayId\ttrainLineNm\t(건수)');
    for (const [k, n] of seen) console.log(`${k}\t(${n})`);
  }
} catch (e) {
  console.error(e instanceof UpstreamError ? describeError('서울 지하철', e) : '실행 오류');
  process.exit(1);
}
