# 환승판 (transit-hub)

출퇴근용 한 화면 대시보드. 앱을 열면 자동 조회되고, 큰 **지금 확인** 버튼은 즉시 새로고침이다.

1. 지하철이 몇 분 뒤에 오는지 (초 단위, 다음 열차 2대 함께)
2. 내릴 역에서 가장 빠른 **칸-문** (예: `4-2`)
3. 내린 뒤 이어 탈 버스 — 지금 열차를 타면 정류장에 도착할 시각을 계산해 **그때 탈 수 있는 첫 버스**를 초록으로 강조

> ⚠️ `config.json` 에는 개인 동선(역·정류장)이 들어간다. **저장소는 반드시 비공개여야 한다.** 실제 값을 넣기 전에 저장소 공개 여부를 확인할 것.

## 구조

```
public/            정적 파일 (index.html, style.css, app.js, manifest, icons)
functions/api/dash.js   GET /api/dash?route=<id>  (Cloudflare Pages Functions)
lib/               compute(순수 계산) · upstream(외부 API·캐시) · mock · dash(조립)
config.json        경로 설정 (import 로 번들)
data/fast-exit.json     빠른하차 칸-문 로컬 데이터 (import 로 번들)
scripts/find-stop.js    정류소명 → nodeId
scripts/probe-subway.js 서울 API 가 역을 어떻게 내려주는지 확인
tests/             node --test
```

`config.json`·`data/` 는 `public/` 밖에 있어 URL 로 직접 받을 수 없다(검증: `/config.json` 등 → 404).

## 실행

```bash
npm install
npm test                 # 계산 규칙 테스트
npm run dev:mock         # http://127.0.0.1:8788  — 모의 데이터(키 불필요)
cp .env.example .dev.vars   # 키를 채우면 LIVE
npm run dev
```

키가 둘 다 없거나 `MOCK=1` 이면 모의 모드이며 화면 상단에 **모의 데이터** 배지가 뜬다.
키가 하나만 있으면 LIVE 이고, 없는 쪽은 `warnings` 로 알린다.

## 배포 (Cloudflare Pages)

1. 저장소 연결, 프로젝트 루트 `transit-hub/`, 빌드 명령 없음, 출력 디렉터리 `public`
2. Settings → Variables and Secrets 에 `SEOUL_API_KEY`, `DATA_GO_KR_KEY` 입력 (Secret 권장)
3. 개인 동선이 노출되므로 Cloudflare Access 로 접근을 본인 계정으로 제한하는 것을 권한다.
   (URL 을 아는 누구나 `/api/dash` 로 일일 호출 한도를 소모시킬 수 있다.)
4. iPhone Safari → 공유 → **홈 화면에 추가**

## 동작 규칙 요약

| 항목 | 규칙 |
|---|---|
| 지하철 seconds | `barvlDt > 0` 이면 그 값, 아니면 `arvlMsg2` 의 "N분 M초" 파싱, 아니면 0(진입/도착). 단 "[N]번째 전역"처럼 초 정보가 전혀 없으면 N×120초로 **추정**(3정거장 전 열차를 "곧"으로 보이지 않게) |
| 열차 필터 | `subwayId == lineId` 이고 `trainLineNm` 에 `<toward>방면` 포함(앞이 공백/하이픈/시작일 때만 — 역명 접미 일치 방지). 가까운 순 3개 |
| 정류장 도착 | 첫 열차 seconds + rideMinutes×60 + walkMinutes×60 |
| 탈 수 있는 버스 | 버스 seconds ≥ 정류장 도착 − 30초 인 첫 도착 |
| 관심 노선 | 응답에 없으면 `seconds:null` 행 → "정보 없음(회차 대기 가능)" |
| 캐시/타임아웃 | 같은 업스트림 요청 10초 캐시, 6초 타임아웃. 한쪽 실패 시 나머지는 표시, 사유는 `warnings` |
| 빠른하차 | 방향(`toward`)이 다른 항목은 대체로 쓰지 않는다(문 위치가 반대일 수 있음) |

`exit.toward` 는 "내리는 역에서 열차가 향하는 방향의 다음 역"이다(원흥에서 대화 쪽 → `원당`). `subway.toward` 와 같은 규칙.

## API 검증 상태

이 문서는 **공식 문서 원문을 열람하지 못한 상태**에서 작성됐다(작업 환경에서 `www.data.go.kr`, `data.seoul.go.kr` 접속이 차단됨). 검색 결과로도 아래 미확인 항목은 확정되지 않았다.

| # | 항목 | 상태 | 코드 위치 |
|---|---|---|---|
| 0 | 서울 실시간 지하철 `realtimeStationArrival` 경로·필드(`subwayId`, `trainLineNm`, `barvlDt`, `arvlMsg2/3`, `recptnDt`) | 사용자 제공 확인 내용 기준으로 반영 | `lib/upstream.js` |
| 1 | TAGO 버스도착정보 요청 경로, 초/정거장 필드명(`arrtime`, `arrprevstationcnt`) | **미확인** — 알려진 값을 쓰되 대소문자 변형도 허용 | `TAGO_ARRIVAL_URL`, `fetchBusArrivals` |
| 2 | TAGO 정류소 검색 엔드포인트, 고양시 cityCode(31100) | **미확인** — `find-stop --cities` 로 확인 | `TAGO_STOP_URL`, `TAGO_CITY_URL`, `config.json` |
| 3 | TAGO 의 고양시 광역·마을버스(24A/24B/075B/730/95) 커버리지 | **미확인** — 키 발급 후 실호출로 판단 (아래) | — |
| 4 | 서울 지하철 API 의 3호선 원흥(코레일 구간) 포함 여부 | **미확인** — `probe-subway 원흥` 으로 확인 | `lib/dash.js` 경고 문구 |
| 5 | 서울교통공사 빠른하차정보 API(15143840) URL·필드·코레일 구간 포함 | **미확인** — API 연동은 넣지 않고 로컬 JSON 만 사용 | `lib/dash.js` TODO |

키를 받은 뒤 확인 순서:

```bash
npm run probe-subway -- 원흥        # 3호선이 내려오는지, trainLineNm 표기 확인 → config 의 lineId/toward 교정
npm run find-stop -- --cities       # 고양시 cityCode 확인
npm run find-stop -- 원흥역 31100   # nodeId 확인 → config.json bus.nodeId
```

### TAGO 커버리지가 부족할 때

마을·광역 노선이 TAGO 에서 비거나 GPS 카운트다운이 자주 빠지면 **경기도 버스도착정보 API(공공데이터포털)** 로 바꾸는 것을 비교해 본다. 경기도 API 는 경기도 BIS 원천 데이터라 고양시 노선 반영이 빠를 가능성이 있으나(미검증), 정류소 ID 체계가 TAGO 와 달라 `nodeId` 를 다시 찾아야 한다. 교체 지점은 `lib/upstream.js` 의 `fetchBusArrivals` **한 함수**이며, `[{route, seconds, stopsLeft}]` 만 돌려주면 나머지(계획·화면)는 그대로 동작한다.

## 미구현 / 다음 개선

- 서울교통공사 빠른하차 API 연동 (현재 로컬 JSON)
- `recptnDt`(수신 시각) 만큼 열차 seconds 보정 — 응답이 오래된 경우 실제보다 늦게 보일 수 있음
- 폰트를 Google Fonts 대신 자체 호스팅 (오프라인 캐시는 의도적으로 두지 않음)
