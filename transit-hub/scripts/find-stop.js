#!/usr/bin/env node
// 정류소명 → nodeId 찾기 (TAGO 버스정류소정보)
//   node scripts/find-stop.js 원흥역 [cityCode]
//   node scripts/find-stop.js --cities          # 도시코드 목록(고양시 코드 확인용)
// 키: 환경변수 DATA_GO_KR_KEY 또는 .dev.vars
//
// TODO(unverified): 엔드포인트·파라미터(nodeNm, nodeNo)·응답 필드(nodeid, nodenm, nodeno)는 공식 문서 미열람 상태의 알려진 값이다.
//   응답이 이상하면 lib/upstream.js 의 TAGO_STOP_URL / TAGO_CITY_URL 과 아래 필드명을 문서에 맞춰 고친다.
import { loadVar } from './_env.js';
import { TAGO_CITY_URL, TAGO_STOP_URL, UpstreamError, describeError, tagoItems, tagoRequest } from '../lib/upstream.js';

const args = process.argv.slice(2);
const key = loadVar('DATA_GO_KR_KEY');

async function main() {
  if (!key) throw new UpstreamError('tago', 'no_key');

  if (args[0] === '--cities') {
    const body = await tagoRequest('tago', TAGO_CITY_URL, key, { pageNo: '1', numOfRows: '200' });
    const rows = tagoItems(body);
    console.log('cityCode\tcityName');
    for (const r of rows) console.log(`${r.citycode ?? r.cityCode}\t${r.cityname ?? r.cityName}`);
    return;
  }

  const [name, cityCode = '31100'] = args;
  if (!name) {
    console.error('사용법: node scripts/find-stop.js <정류소명> [cityCode=31100]\n        node scripts/find-stop.js --cities');
    process.exit(2);
  }
  const body = await tagoRequest('tago', TAGO_STOP_URL, key, { cityCode, nodeNm: name, pageNo: '1', numOfRows: '50' });
  const rows = tagoItems(body);
  if (!rows.length) {
    console.log(`결과 없음 (cityCode=${cityCode}, 정류소명="${name}"). 도시코드가 맞는지 --cities 로 확인하세요.`);
    return;
  }
  console.log('nodeId\t\t정류소명\t정류소번호');
  for (const r of rows) console.log(`${r.nodeid ?? r.nodeId}\t${r.nodenm ?? r.nodeNm}\t${r.nodeno ?? r.nodeNo ?? ''}`);
  console.log('\n→ config.json 의 bus.nodeId 에 위 nodeId 를 넣으세요.');
}

main().catch((e) => {
  console.error(e instanceof UpstreamError ? describeError('TAGO', e) : '실행 오류'); // 원본 에러(URL·키 포함 가능)는 출력하지 않음
  process.exit(1);
});
