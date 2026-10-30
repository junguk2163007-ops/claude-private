# jobkit — 구직 서류 자동 생성 웹앱

공고 텍스트를 붙여넣으면 **공고 요약 + 요건 비교 → 이력서 PDF·자기소개서 PDF·지원 메일 → 지원 이력 기록**까지 한 화면에서 끝내는 1인용 웹앱입니다.

작업 흐름: **붙여넣기 → 확인 → 다운로드 → 메일 보내기**

- 사실 정보(인적사항·학력·병역·자격·경력)는 프로필에 한 번만 입력합니다. 공고마다 바뀌는 것은 자기소개서의 **변형 슬롯**(S3 근무형태 문장, 직무경험 접두어, 지원동기 M1/M3, 포부 GAP)과 지원처 표기뿐입니다.
- LLM을 쓰지 않습니다. 파서는 규칙 기반이고, 결과는 항상 수정 가능한 폼으로 보여준 뒤 사용자가 확정합니다.
- 분석은 정보 제공용입니다. 요건을 못 채워도 [서류 생성]은 항상 눌립니다.

## 빠른 시작 (로컬)

이 프로젝트는 `claude-workspace` 저장소의 `jobkit/` 폴더에 있습니다. 아래 명령은 모두 **`jobkit/` 폴더 안에서** 실행합니다.

```bash
cd jobkit
npm install                      # Node 20 이상. Playwright Chromium 이 필요합니다(아래 참고)
cp .env.example .env.local       # APP_PASSWORD 를 꼭 바꾸세요
npm run dev                      # http://localhost:3000 → 로그인
```

- Chromium이 없다면 `npx playwright install chromium` 을 한 번 실행하세요(Docker 이미지에는 들어 있습니다). 이미 설치된 Chromium을 쓰려면 `CHROMIUM_PATH=/경로/chrome`.
- 첫 실행 때 `seed/profile.json`, `seed/blocks.json` 이 DB(`data/jobkit.db`)에 한 번 주입됩니다. `seed/` 가 없으면 `seed.example/`(가상 인물 홍길동)을 씁니다.
- `seed/` 와 `data/` 는 개인정보이므로 `.gitignore` 에 들어 있습니다. 원격 저장소에 올리지 마세요.
- 시드는 DB가 비어 있을 때만 들어갑니다. 시드를 바꾼 뒤 다시 주입하려면 `data/jobkit.db*` 를 지우고 재시작하세요(지원 이력도 지워지므로 먼저 백업).

### 화면

| 경로 | 내용 |
|---|---|
| `/apply` | 공고 붙여넣기 → [분석] → 파싱 폼(수정 가능) → 요약 카드 → 요건 비교표 → 신호등 → 경고 → 추가 첨부 체크 → [서류 생성] → 오른쪽에 PDF 미리보기·다운로드·zip, 메일 제목/본문, Gmail/메일앱 버튼, [지원함으로 기록] |
| `/history` | 지원 목록, 전화번호/단지명 검색, 상태 변경, 행 클릭 시 보낸 PDF·메일·공고 원문·메모, CSV 내보내기 |
| `/profile` | 인적사항·사진·학력·병역·자격·경력, 보유 자격/경력 목록(보유 토글 즉시 반영), 자소서·이력서·메일 문구 블록 |
| `/settings` | 근거리 지역 키워드, 메일 서명, 비밀번호 안내 |

## 테스트

```bash
npm test          # Vitest: 파서·분석·문서 조합·메일·PDF 렌더링·다운로드 헤더·인증·스키마 (64개)
npm run typecheck
```

- `tests/fixtures/F1~F4` 공고 4개로 명세의 기대값을 검증합니다. 날짜 기준은 2026-10-24로 고정합니다.
- 렌더링 테스트는 실제 Chromium으로 PDF를 만든 뒤 이력서가 정확히 1페이지인지, 모든 폰트가 Noto Sans KR로 임베드됐는지, 텍스트를 뽑았을 때 한글이 깨지지 않는지(� 없음) 확인합니다.
- 테스트는 매번 임시 data 폴더를 씁니다. 프로필 값은 `seed/` 가 있으면 그것을, 없으면 `seed.example/` 을 씁니다.

## Docker

```bash
echo "APP_PASSWORD=긴-비밀번호" > .env
echo "SESSION_SECRET=$(openssl rand -hex 32)" >> .env
docker compose up -d --build      # http://localhost:3000
```

- 이미지: `mcr.microsoft.com/playwright:v1.63.0-noble` 기반(Chromium 포함). `package.json` 의 `playwright` 버전을 바꾸면 Dockerfile 태그도 같이 바꾸세요.
- `/data` 는 볼륨입니다(`./data`). `./seed` 는 `/data/seed` 에 읽기 전용으로 마운트되어 첫 실행 때만 쓰입니다.
- 쿠키는 프로덕션에서 `Secure` 입니다. `http://localhost` 는 브라우저가 안전한 주소로 취급하므로 문제없습니다. 사내망 IP 등으로 http 접속하려면 `COOKIE_INSECURE=1`.

## 배포

단일 사용자·SQLite 앱이므로 **머신 1대 + 영구 볼륨 1개**로 운영합니다(여러 대로 늘리지 마세요). Chromium 때문에 메모리는 1GB를 권장합니다.

`Dockerfile` 이 저장소 루트가 아니라 `jobkit/` 에 있으므로, 배포 서비스의 **빌드 기준 폴더(Root Directory / build context)를 `jobkit/`** 으로 지정해야 합니다.

### Fly.io

```bash
cd jobkit                               # fly 명령은 jobkit/ 안에서 실행 (fly.toml 과 Dockerfile 이 있는 곳)
cp fly.toml.example fly.toml            # app 이름 수정. 리전은 도쿄(nrt) 기본
fly launch --no-deploy --copy-config
fly volumes create jobkit_data --size 1 --region nrt
fly secrets set APP_PASSWORD='긴-비밀번호' SESSION_SECRET="$(openssl rand -hex 32)"
fly deploy
```

개인 시드를 넣으려면 **첫 배포 전에** 볼륨에 올리거나, 배포 뒤 `/profile` 에서 직접 입력하세요.

```bash
fly ssh sftp shell
» mkdir /data/seed
» put seed/profile.json /data/seed/profile.json
» put seed/blocks.json /data/seed/blocks.json
# 이미 예시 시드로 시작됐다면: fly ssh console -C "rm /data/jobkit.db /data/jobkit.db-wal /data/jobkit.db-shm" 후 fly machine restart
```

로컬에서 만든 데이터를 그대로 옮기려면 `npm run backup` 결과 폴더의 `jobkit.db`, `photo/`, `pdf/` 를 같은 방식으로 `/data` 에 올립니다(앱을 멈춘 상태에서).

### Railway

1. `claude-workspace` 저장소를 연결하고, 서비스 Settings → **Root Directory** 를 `/jobkit` 으로 지정합니다. 그러면 `jobkit/Dockerfile` 로 빌드됩니다.
2. 서비스에 **Volume** 을 추가하고 마운트 경로를 `/data` 로 지정합니다.
3. Variables: `APP_PASSWORD`, `SESSION_SECRET` (필요하면 `PORT=3000`).
4. 볼륨에 파일을 직접 올리는 방법이 마땅치 않으므로, 첫 실행(예시 시드) 뒤 `/profile` 에서 인적사항·사진·문구를 입력하는 방식을 권장합니다.

## 백업

백업 대상은 `/data` 폴더 하나입니다.

| 파일 | 내용 |
|---|---|
| `jobkit.db` (+ `jobkit.db-wal`, `jobkit.db-shm`) | 프로필, 자격 목록, 문구 블록, 설정, 지원 이력(공고 원문·메일 포함) |
| `photo/` | 증명사진 |
| `pdf/{지원ID}/resume.pdf`, `letter.pdf` | 실제로 보낸 이력서·자기소개서 |
| (`seed/`) | 첫 실행용 시드 원본. 저장소 밖에 따로 보관 |

- 실행 중 안전한 백업: `npm run backup` → `backups/jobkit-날짜/` 에 DB 스냅샷 + 사진 + PDF 복사.
  - Docker: `docker compose exec jobkit node scripts/backup.mjs /data/backups/$(date +%Y%m%d)` → 호스트의 `./data/backups/` 에 생깁니다.
  - Fly.io: `fly ssh console -C "node scripts/backup.mjs /data/backups/today"` 후 `fly ssh sftp get` 으로 내려받습니다.
- 앱을 멈춘 상태라면 `data/` 폴더를 통째로 복사해도 됩니다. 실행 중에 파일을 복사할 때는 `-wal`, `-shm` 파일도 함께 복사하세요.
- 백업 파일에는 개인정보가 들어 있습니다. 암호화된 위치에 보관하세요.

## 보안과 개인정보

- 로그인: 환경변수 `APP_PASSWORD`. HMAC-SHA256 으로 서명한 httpOnly·SameSite=Lax 쿠키(14일). 비밀번호를 바꾸면 기존 세션은 모두 무효가 됩니다.
- 로그인 시도 제한: IP당 15분에 5번 실패 시 15분 잠금, 전체 1시간 50번 실패 시 전체 잠금(메모리 기반).
- 모든 경로가 로그인 필요(로그인 화면 제외). 상태를 바꾸는 API는 다른 출처(Origin)에서 오면 거부합니다.
- 모든 응답에 `X-Robots-Tag: noindex`, 페이지에 `<meta name="robots" content="noindex">`, `robots.txt` 는 전체 차단. 분석/트래킹 스크립트 없음. 폰트는 저장소의 로컬 파일만 사용합니다.
- 증명사진과 PDF는 인증된 API(`/api/photo`, `/api/applications/{id}/file`)로만 제공합니다. `public/` 폴더는 쓰지 않습니다.
- 주민등록번호·등본·통장 사본·계좌번호를 입력받거나 저장하는 필드가 없습니다(스키마가 알 수 없는 키를 거부하고, 테스트가 이를 검사합니다). 추가 첨부 체크박스는 메일 문구용 on/off 일 뿐입니다.
- 서버 로그에는 에러 종류만 남깁니다. 지원 이력 검색은 브라우저에서 해서 전화번호가 요청 URL·로그에 남지 않습니다.

## 폴더 구조

```
app/                 화면(/apply /history /profile /settings /login)과 API 라우트
components/          화면 컴포넌트
lib/parser           규칙 기반 공고 파서 (줄 분할·섹션 추적·라벨 추출·필수 문구)
lib/analyze          요건 비교표, 신호등, 경고, 지원 이력 대조
lib/render           compose(변형 슬롯) → HTML 템플릿 → Playwright PDF(1페이지 자동 맞춤)
lib/mail             메일 제목/본문, Gmail·mailto URL
lib/db               SQLite 스키마·시드·저장소
lib/auth             세션 서명, 로그인 시도 제한
assets/fonts         Noto Sans KR Regular/Bold (OFL, OFL.txt 동봉)
seed.example/        예시 시드 (실제 seed/ 는 gitignore)
tests/               Vitest + fixtures
scripts/backup.mjs   백업
```

## 가정

명세에서 정하지 않았거나 해석이 필요했던 부분입니다.

1. **오늘 날짜**는 항상 Asia/Seoul 기준입니다. 테스트는 명세 예시에 맞춰 2026-10-24로 고정합니다.
2. **포부 GAP 연결**: 명세는 promise_phrase 를 "와/과"로 잇게 했지만, 시드 문구가 "~취득", "~준비"처럼 '하다'가 붙는 형태라 "와/과"로 이으면 비문이 됩니다("…준비와 …취득하여"). 그래서 `A하고, B` + `하여 업무 전문성을 넓혀가겠습니다` 로 잇습니다. 끝맺음과 기본 문구는 블록으로 편집할 수 있습니다.
3. **GAP 순서**: 필수(명시) → 필수로 보임 → 우대 순, 같은 등급은 공고 순서. (F3: 에너지관리기사 → 소방)
4. **"아파트 시설관리 실무 경력은 없지만, " 접두어**는 `key=apt_exp` 항목(아파트 근무 경력)이 [필수로 보임] 또는 [필수(명시)]로 걸리고 미보유일 때 붙습니다.
5. **한 줄에 별칭이 겹치면 긴 별칭이 이깁니다.** 예: F2 "아파트 및 관련 업무 유경험자"는 "관련 업무 유경험"보다 긴 "아파트 및 관련 업무"(아파트 근무 경력)로 판정해 요건이 3개가 됩니다. 별칭 비교는 공백을 무시합니다.
6. **"직접 확인" 행**은 요건 섹션(자격·요건·우대·지원조건·응시)에 있으면서 별칭에 안 걸린 줄만 만듭니다. 근무조건·급여 섹션의 줄은 만들지 않습니다(별칭에 걸린 줄은 어느 섹션이든 행을 만듭니다). 빈 줄 다음의 글머리표 없는 줄은 앞 섹션에서 벗어난 것으로 봅니다.
7. **근거리 판정**은 공고 주소만 봅니다. F3처럼 주소가 없으면 근거리가 아닌 것으로 보고 거리 문장(M1)을 넣지 않으며 "통근 거리 직접 확인" 경고를 띄웁니다(가깝다고 거짓으로 쓰지 않기 위해). 폼에 주소를 넣으면 바로 다시 판정합니다.
8. **따옴표 없는 필수 기재 문구**는 "상단에/제목에 ○○ (꼭·반드시·필수) 기재/표기" 형태에서만 추출합니다. "지원분야_성명" 같은 양식 문구는 추출하지 않고 비워 둡니다.
9. **출근예정일이 지났어도**(F2) 명세대로 자소서 M3와 메일 START 문구에는 그대로 쓰고, 화면에서만 "출근 예정일이 지났습니다" 경고를 띄웁니다.
10. **지원 이력 대조**에서 "작성중" 건은 세지 않습니다(서류만 만들고 보내지 않은 건).
11. **서류 생성 시점**에 지원 이력이 "작성중"으로 저장되고 PDF가 `data/pdf/{id}/` 에 남습니다. 작성중 상태에서 다시 생성하면 같은 건을 덮어쓰고, [지원함으로 기록] 이후 다시 생성하면 새 건이 됩니다(보낸 서류는 보존).
12. **추가 첨부 체크박스**는 공고 제출서류에 자격증 사본이 있으면 그것만 미리 체크합니다. 등본·통장 사본은 미리 체크하지 않습니다.
13. **"고용24뿐"** 은 공고에 이메일 주소가 없고 다른 접수 경로만 있을 때로 판단합니다.
14. **학력**은 목록의 마지막 항목을 "최종학력"으로 표시합니다. 경력은 입력 순서 그대로 표시합니다.
15. **메일 본문 템플릿**과 이력서 소개 3문단도 블록(`/profile`)으로 편집할 수 있게 했습니다. 서명은 `/settings` 의 `{name} 드림\n{phone}`.
16. **qualifications 시드**는 `seed/profile.json` 안에 profile·settings 와 함께 둡니다. 화면에 보이지 않는 내부 `key` 를 추가했습니다(예: `apt_exp`).
17. **폰트**: Noto Sans KR 가변 폰트는 Chromium PDF에서 Type 3(외곽선)로 임베드되어, fonttools 로 Regular(400)/Bold(700) 정적 인스턴스를 만들어 넣었습니다(CID TrueType 서브셋 임베드).
18. **이력서 크기 맞춤**: 10.5pt에서 시작해 글자·여백·줄간격을 8단계로 줄이며, 최소 9pt(여백 8mm)에서도 넘치면 화면에 경고합니다. 지원처 표기 줄은 항상 12.5pt 굵게 유지합니다. 자기소개서는 1페이지(최소 10pt)를 먼저 시도하고, 안 되면 2페이지를 허용합니다.
19. 명세의 "보유 자격 목록 - 공인중개사 등"에 별칭이 없어서 이름 자체를 별칭으로 씁니다.

## 알려진 한계

- 파서는 규칙 기반이라 표가 깨진 채 붙여넣었거나 라벨이 특이하면 값을 못 찾습니다. 폼에서 직접 고치세요(고치면 분석이 바로 갱신됩니다).
- 근무형태는 문구로만 분류합니다("격일"이 있으면 교대 표기가 함께 있어도 격일).
- 근거리 판정은 키워드 포함 여부입니다. 예: "칠곡"은 경북 칠곡군 주소에도 걸립니다.
- 브라우저는 메일에 파일을 자동 첨부할 수 없습니다. PDF를 내려받아 직접 첨부해야 합니다. 아주 긴 본문은 Gmail 작성창 URL 길이 제한에 걸릴 수 있습니다(그때는 [본문 복사]).
- PDF 미리보기는 브라우저 내장 PDF 뷰어를 씁니다(데스크톱 Chrome/Edge 기준).
- 로그인 시도 제한은 메모리 기반이라 재시작하면 초기화됩니다. IP는 프록시 헤더(`fly-client-ip`, `x-forwarded-for`)를 믿으므로, 헤더를 위조한 시도는 전체 제한(1시간 50번)으로만 막힙니다.
- SQLite 단일 파일이라 앱 인스턴스는 1대만 운영해야 합니다.
- Docker 이미지의 Chromium은 PDF 생성 때 메모리를 수백 MB 씁니다.

## 다음 단계 제안 (Phase 2, 미구현)

1. **LLM 보조 파싱**: `ANTHROPIC_API_KEY` 가 있을 때만, 규칙 파서가 비워 둔 필드를 구조화 JSON(스키마 고정, 원문에 없는 값은 null)으로 보완합니다. 원문 인용 위치를 함께 받아 검증하고, 자소서 본문은 계속 블록만 씁니다.
2. **통근 시간**: 카카오/네이버 길찾기 API로 집→근무지 대중교통·자차 소요시간을 요약 카드에 표시하고, 근거리 판정을 "N분 이내"로 바꿀 수 있게 합니다.
3. **고용24 입력용 텍스트 세트**: 이력서 제목 1 + 자소서 제목 1 + 항목별 제목 6 + 본문 6 + 입사지원동기 1을 복사 버튼과 함께 출력합니다(제목에 특수문자·이름 금지, 본문마다 소제목 2~3개, 글자 수 표시).
4. **면접 대비 메모**: 경력 공백 설명, 예상 질문 답변을 지원 건별로 저장하고 보낸 서류와 나란히 보여줍니다(서류에는 넣지 않음).
