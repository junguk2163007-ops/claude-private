// 흐름 데이터 — 화면 렌더링 코드(app.js)와 분리되어 있다.
// 새 민원 가지는 이 파일의 FLOW에 노드를 추가하고 `node validate.js`로 검사한다.
//
// 노드 필드
//   id        노드 키와 같아야 함
//   type      question | info | check | result | record
//   stage     상단 바에 표시할 단계 이름
//   badge     판정 배지 (선택, 예: "B. N선 단선")
//   title     제목 (result는 badge가 있으면 생략 가능)
//   sub       제목 아래 보조 문구 (선택)
//   body      본문 문장 배열 (선택)
//   warn      경고 문구 — 빨간 박스, 항상 펼침 (선택)
//   note      💡 부연설명 — 노란 말풍선, 접힘 (문자열 또는 배열, 선택)
//   table     카드형 표 { cols, rows } (선택)
//   checks    체크리스트 [{ text, detail?, required? }] (선택)
//   checksTitle  체크리스트 제목 (선택)
//   sequential   true면 위에서부터 순서대로만 체크 가능 (check 화면)
//   measure   true면 전압 3종 입력칸 표시
//   options   [{ label, sub?, kind?, next }] — question 필수, info에서도 사용 가능
//             kind: yes(파랑) | no(주황) | alt(회색) | next(진행) — 생략 시 순서대로 yes, no, alt
//   next      다음 노드 id (info·check·result)
//   nextLabel "다음" 버튼 문구 변경 (선택)
//   verdict   당직일지 '판정'에 쓸 이름 (선택, 없으면 result의 badge/title)

export const START_ID = 'START';
export const RECORD_ID = 'RECORD';

export const FLOW = {
  START: {
    id: 'START', type: 'info', stage: '접수',
    title: '민원 접수 · 정황 확인',
    body: ['전화 한 통에서 원인의 절반이 정해진다.', '출동 전과 도착 직후 아래를 확인한다.'],
    checks: [
      { text: '층(F)과 범위', detail: '콘센트 1개 / 한 줄 / 구역 / 층 전체' },
      { text: '시점과 변화', detail: '공사, 정전·복전, 이사·자리 배치 변경, 히터·공사업체 장비 사용' },
      { text: '다른 것은 되는가', detail: '같은 구역 전등, 옆 구역 콘센트' },
      { text: '전용부·공용부 경계', detail: '책상 일체형 멀티탭, 입주사 자체 분전반, 입주사가 교체한 등기구는 입주사 소관일 수 있음' },
    ],
    note: [
      '범위가 좁을수록 하류(콘센트·접속부), 넓을수록 상류(분전반·ELB·컨택터) 문제일 가능성이 크다.',
      '전등은 되고 전열만 안 되면 전열 회로로 좁혀진다.',
      '단순 램프 교체는 이 알고리즘 대상이 아니다.',
      '멀티탭·입주사 분전반은 전용부 경계이므로 건물 설비와 구분한다.',
    ],
    next: 'Q_LIGHT',
  },

  Q_LIGHT: {
    id: 'Q_LIGHT', type: 'question', stage: '접수',
    title: '전등 민원입니까?',
    sub: '램프만 교체하면 되는 건은 대상 아님',
    options: [
      { label: '예', next: 'Q_LIGHT_ALL' },
      { label: '아니오', sub: '전열 민원', next: 'Q_RANGE' },
    ],
  },

  // ───────── 전열 ─────────
  Q_RANGE: {
    id: 'Q_RANGE', type: 'question', stage: '범위',
    title: '불통 범위가 콘센트 1개입니까?',
    note: '콘센트 1개면 증상 위치부터, 한 줄·구역·층 전체면 분전반부터 본다.',
    options: [
      { label: '예', next: 'MEASURE' },
      { label: '아니오', sub: '한 줄·구역·층 전체', next: 'PANEL' },
    ],
  },

  MEASURE: {
    id: 'MEASURE', type: 'info', stage: '측정',
    title: '증상 콘센트에서 전압 3종 측정',
    body: ['L-N, L-PE, N-PE 세 가지를 같이 잰다.', '한 가지만 재면 오판하기 쉽다.'],
    table: {
      cols: ['측정', '정상값', '의미'],
      rows: [
        ['L-N', '약 220V', '실제로 기기에 걸리는 전압. 접지 유무와 상관없이 이 전압이 있어야 전기가 들어온 것'],
        ['L-PE', '약 220V', '접지 기준 L 구멍은 220V가 정상. 0V면 L선이 오지 않는 것'],
        ['N-PE', '약 0V', 'N은 접지와 거의 같은 전위여야 정상. 220V 근처면 N이 끊겨 떠 있다는 신호'],
      ],
    },
    note: [
      '측정할 때 그 회로에 부하(PC 등)가 꽂혀 있었는지 같이 기록한다.',
      'N이 끊긴 구간은 부하를 통해 L쪽 전압이 N으로 올라와 N-PE가 220V 근처로 나오는데, 부하를 뽑으면 값이 달라질 수 있다.',
      '접지테스터(TK-21)의 "이상" 표시만 보고 접지 문제로 단정하지 말고 반드시 전압 값으로 확인한다.',
    ],
    measure: true,
    next: 'Q_LN',
  },

  Q_LN: {
    id: 'Q_LN', type: 'question', stage: '측정',
    title: 'L-N 전압이 약 220V입니까?',
    options: [
      { label: '예', next: 'A' },
      { label: '아니오', next: 'Q_LPE' },
      { label: '값이 흔들리거나 낮음', kind: 'alt', next: 'D' },
    ],
  },

  Q_LPE: {
    id: 'Q_LPE', type: 'question', stage: '측정',
    title: 'L-PE 전압이 약 220V입니까?',
    options: [
      { label: '예', next: 'Q_NPE' },
      { label: '아니오', sub: '0V', next: 'C' },
    ],
  },

  Q_NPE: {
    id: 'Q_NPE', type: 'question', stage: '측정',
    title: 'N-PE 전압이 220V 근처입니까?',
    sub: '부하가 꽂힌 상태에서',
    options: [
      { label: '예', next: 'B' },
      { label: '아니오', next: 'D' },
    ],
  },

  A: {
    id: 'A', type: 'result', stage: '판정',
    badge: 'A. 전기는 들어옴',
    title: '건물 설비 정상. 입주사 기기·멀티탭 문제.',
    body: [
      '같은 콘센트에 다른 기기를 꽂아 비교한다.',
      '다른 기기가 동작하면 원래 기기 문제다.',
      '책상 일체형 멀티탭이면 멀티탭 자체 스위치·과부하 차단·퓨즈를 확인한다(여기부터는 전용부일 수 있음).',
      '건물 설비는 정상임을 입주사에 안내하고 기록한다.',
    ],
    next: 'RECORD',
  },

  B: {
    id: 'B', type: 'result', stage: '판정',
    badge: 'B. N선 단선',
    body: [
      '상류(분전반 출력단)의 N-PE는 0V다.',
      '하류로 내려가며 재다가 N-PE가 0V에서 220V로 바뀌는 지점 사이가 경계다.',
      '의심 위치: 플로어박스 내부 접속부, 이사·책상 이동 뒤 빠진 N선, 콘센트 단자 풀림, 조인트 박스.',
    ],
    note: '(퀴즈 #2) 차단기가 정상이어도 끝이 아니다. 이사·자리 변경 뒤에는 플로어박스 접속부를 의심한다.',
    next: 'SAFE',
  },

  C: {
    id: 'C', type: 'result', stage: '판정',
    badge: 'C. L선 / 상류 전원 불량',
    body: [
      '콘센트에 L이 아예 오지 않는다.',
      '차단기 OFF·트립, 분기 ELB 트립, 상류 접속부 단선, 컨택터 문제를 의심한다.',
      '분전반으로 이동해 출력단 전압부터 확인하고 상류에서 하류로 추적한다.',
    ],
    next: 'PANEL',
    nextLabel: '분전반 확인으로',
  },

  D: {
    id: 'D', type: 'result', stage: '판정',
    badge: 'D. 접촉불량·과부하',
    warn: '발열·변색·탄 냄새가 있으면 즉시 차단하고 보고한다.',
    body: [
      '접속부 풀림, 단자 산화, 헐거운 플러그로 접촉저항이 커져 전압이 흔들린다.',
      '클램프미터(3280-10F)로 해당 회로 부하 전류를 재서 과부하 여부를 본다.',
    ],
    next: 'SAFE',
  },

  // ───────── 분전반 ─────────
  PANEL: {
    id: 'PANEL', type: 'info', stage: '분전반',
    title: '분전반 확인 (상류 → 하류)',
    body: [
      '해당 회로의 분기 ELB·MCB를 찾아 핸들 위치를 확인한다.',
      '핸들이 ON처럼 보여도 출력단 전압을 직접 잰다.',
      '순서: 층 분전반 → 분기 ELB → 플로어박스·접속부 → 콘센트.',
    ],
    note: '중간 위치로 걸린 트립은 눈으로만 보면 놓친다.',
    next: 'Q_TRIP',
  },

  Q_TRIP: {
    id: 'Q_TRIP', type: 'question', stage: '분전반',
    title: '분기 ELB·MCB가 트립 상태입니까?',
    sub: '핸들이 중간 위치 또는 OFF',
    options: [
      { label: '예', next: 'E' },
      { label: '아니오', sub: 'ON', next: 'Q_OUT' },
    ],
  },

  Q_OUT: {
    id: 'Q_OUT', type: 'question', stage: '분전반',
    title: '핸들이 ON입니다. 출력단에서 직접 측정했을 때 전압이 있습니까?',
    options: [
      { label: '예', next: 'G' },
      { label: '아니오', sub: '0V', next: 'C_UP' },
    ],
  },

  C_UP: {
    id: 'C_UP', type: 'result', stage: '판정',
    badge: 'C. 상류 전원 불량',
    body: ['출력단 전압이 없다.', '상류(상위 차단기, 컨택터, 상류 접속부)로 추적한다.'],
    next: 'SAFE',
  },

  E: {
    id: 'E', type: 'question', stage: '트립',
    badge: 'E. 트립',
    title: '완전 OFF 후 ON으로 재투입했더니 바로 다시 트립됩니까?',
    warn: '원인을 확인하기 전에 바로 재투입하지 않는다. 재투입은 완전 OFF 후 ON. 중간 위치에서 ON 방향으로 밀기만 해서는 안 된다.',
    note: '(퀴즈 #1) 15F 사무실 전열 전체 불통 → 분기 ELB 중간 트립이었음. 핸들이 애매하면 출력단 전압으로 확인한다.',
    options: [
      { label: '예', sub: '재트립', next: 'F' },
      { label: '아니오', sub: '정상 복귀', next: 'E_OK' },
    ],
  },

  E_OK: {
    id: 'E_OK', type: 'info', stage: '트립',
    title: '재투입 후 정상 복귀',
    body: [
      '정상으로 돌아와도 왜 트립됐는지 입주사에 묻는다(히터, 장비 추가, 공사 등).',
      '이 내용을 기록해 둔다.',
    ],
    verdict: 'E. 트립 (재투입 후 정상 복귀)',
    next: 'RESTORE',
  },

  F: {
    id: 'F', type: 'question', stage: '트립',
    badge: 'F. 반복 트립 — 메가로 판단',
    title: '부하를 분리하고 메가(500V 레인지)로 측정했을 때 1MΩ 이상입니까?',
    warn: '메가(IR4033)는 측정 전에 반드시 부하를 분리한다(SMPS, LED 드라이버, PC). 연결된 채 높은 전압을 가하면 부하측 기기가 손상될 수 있다.',
    body: ['500V 이하 회로는 500V 레인지로 측정하며 1MΩ 이상이면 정상이다.'],
    options: [
      { label: '예', sub: '1MΩ 이상', next: 'F_OK' },
      { label: '아니오', sub: '1MΩ 미만', next: 'F_BAD' },
    ],
  },

  F_OK: {
    id: 'F_OK', type: 'result', stage: '판정',
    title: '메가 정상인데 반복 트립',
    body: [
      '기기 기동 시 돌입전류, PC·SMPS 누설전류 누적, 공사업체 장비, 결로 등 일시 누설을 의심한다.',
      '클램프미터로 시간대별 전류를 확인한다.',
    ],
    verdict: 'F. 반복 트립 — 메가 정상',
    next: 'RECORD',
  },

  F_BAD: {
    id: 'F_BAD', type: 'result', stage: '판정',
    title: '절연 불량 의심 (1MΩ 미만)',
    body: ['부하를 분리한 상태에서 구간을 좁혀 확정한다.'],
    verdict: 'F. 반복 트립 — 절연 불량 의심 (1MΩ 미만)',
    next: 'SAFE',
  },

  G: {
    id: 'G', type: 'info', stage: '하류 추적',
    badge: 'G. 차단기 정상',
    title: '하류로 내려가 경계 찾기',
    body: [
      '출력단에 전압이 있으면 분전반은 정상이다.',
      '분기 ELB → 플로어박스·접속부 → 콘센트 순으로 전압을 재며 경계를 줄여 간다.',
      '살아 있는 마지막 지점과 처음 죽은 지점 사이가 고장 구간이다.',
    ],
    next: 'Q_BOUNDARY',
  },

  Q_BOUNDARY: {
    id: 'Q_BOUNDARY', type: 'question', stage: '하류 추적',
    title: '살아 있는 마지막 지점과 처음 죽은 지점(경계)을 찾았습니까?',
    options: [
      { label: '예', next: 'SAFE' },
      { label: '아니오', next: 'G_RETRY' },
    ],
  },

  G_RETRY: {
    id: 'G_RETRY', type: 'info', stage: '하류 추적',
    title: '경계 미확정',
    body: [
      '한 단계씩 하류로 다시 측정하고, 전용부 경계(멀티탭, 입주사 분전반, 교체 등기구)를 다시 구분한다.',
      '끝내 못 찾으면 보고하고 기록한다.',
    ],
    options: [
      { label: '다시 하류로 측정', kind: 'next', next: 'G' },
      { label: '보고·기록으로', kind: 'alt', next: 'RECORD' },
    ],
  },

  // ───────── 전등 ─────────
  Q_LIGHT_ALL: {
    id: 'Q_LIGHT_ALL', type: 'question', stage: '전등',
    title: '층·구역 전체가 불점등입니까?',
    options: [
      { label: '예', next: 'L_ALL' },
      { label: '아니오', sub: '일부 등기구', next: 'Q_TENANT' },
    ],
  },

  L_ALL: {
    id: 'L_ALL', type: 'result', stage: '전등',
    badge: '전등 · 층·구역 전체 불점등',
    body: [
      'ELB, 컨택터, 제어 전원, 신규 공사구역 여부를 확인한다.',
      '한 번에 여러 구역이면 상류 한 점 문제 가능성이 크다.',
    ],
    next: 'PANEL',
  },

  Q_TENANT: {
    id: 'Q_TENANT', type: 'question', stage: '전등',
    title: '입주사가 교체한 등기구입니까?',
    options: [
      { label: '예', next: 'L_TENANT' },
      { label: '아니오', next: 'Q_LIGHT_IN' },
    ],
  },

  L_TENANT: {
    id: 'L_TENANT', type: 'result', stage: '전등',
    title: '입주사 교체 등기구',
    body: ['전용부 경계를 확인한 뒤 입주사에 안내한다.'],
    next: 'RECORD',
  },

  Q_LIGHT_IN: {
    id: 'Q_LIGHT_IN', type: 'question', stage: '전등',
    title: '불점등 등기구의 입력 단자에 전압이 있습니까?',
    note: '전등은 램프보다 제어계통 문제가 많아 램프를 바꿔도 소용없는 경우가 있다. 램프 문제가 아니므로 입력 전압을 먼저 확인한다.',
    options: [
      { label: '예', next: 'L_DRIVER' },
      { label: '아니오', next: 'L_CTRL' },
    ],
  },

  L_DRIVER: {
    id: 'L_DRIVER', type: 'result', stage: '전등',
    title: '컨버터·LED 드라이버 불량',
    body: ['입력 전압이 있는데 불점등이면 컨버터·LED 드라이버 불량이다.'],
    next: 'SAFE',
  },

  L_CTRL: {
    id: 'L_CTRL', type: 'result', stage: '전등',
    title: '상류·제어계통 추적',
    body: [
      '입력 전압이 없으면 상류(스위치·릴레이·접속부)를 추적한다.',
      '제어계통 의심 대상: 릴레이, DC24V 스위치 모듈, 타임스위치, BMS 스케줄, 자동소등 설정.',
    ],
    note: '스케줄·소등은 고장이 아니라 정상 동작일 수 있으니 설정부터 확인한다.',
    next: 'SAFE',
  },

  // ───────── 공통 마무리 ─────────
  SAFE: {
    id: 'SAFE', type: 'check', stage: '안전',
    title: '안전 조치',
    sub: '순서 고정 — 위에서부터 차례로 체크',
    sequential: true,
    checks: [
      { text: '① 차단기 OFF', required: true },
      { text: '② 잠금·표시', required: true },
      { text: '③ 검전지(HIOKI 2512E)로 무전압 확인', required: true },
      { text: '④ 무전압 확인 전에는 어떤 단자도 만지지 않았다', required: true },
    ],
    note: '검전지(2512E)는 비접촉 AC 40~600V 저압 전용이다.',
    next: 'LOCATE',
  },

  LOCATE: {
    id: 'LOCATE', type: 'info', stage: '구간 확정',
    title: '구간 확정',
    body: [
      '전압시험으로 구간을 좁히고 도통시험으로 확정한다.',
      '전압시험은 통전 상태에서 어디까지 전기가 오는지 보는 것이고, 도통시험은 무전압 상태에서 선이 이어졌는지 확인하는 것이다.',
      '순서를 바꾸지 않는다.',
      '도통·절연시험은 부하를 분리한 상태에서 한다.',
    ],
    checksTitle: '육안 점검',
    checks: [
      { text: '단자 풀림' },
      { text: '선 탈락' },
      { text: '변색·탄 흔적' },
      { text: '습기·결로' },
      { text: '최근 공사 흔적' },
    ],
    warn: '접지 불량이 보여도 개별 콘센트에 접지를 임의로 연결하지 않는다. 보고하고 기록한다.',
    next: 'RESTORE',
  },

  RESTORE: {
    id: 'RESTORE', type: 'info', stage: '복구',
    title: '복구 · 재확인',
    checks: [
      { text: '빠진 선은 규격에 맞게 재결선', detail: '같은 박스의 다른 접속부 풀림도 함께 확인' },
      { text: '완전 ON 후 해당 회로 콘센트 전부에서 L-N 220V 확인' },
      { text: '클램프미터로 부하 전류 확인' },
      { text: '접지테스터로 극성·접지 재확인' },
    ],
    next: 'RECORD',
  },

  RECORD: {
    id: 'RECORD', type: 'record', stage: '기록',
    title: '당직일지 기록',
  },
};

// ───────── 메뉴 화면 내용 ─────────
export const PAGES = {
  checklist: {
    title: '출동 체크리스트',
    items: [
      '층(F)·범위·시점·최근 변화 확인',
      '전용부 경계 구분',
      '증상 콘센트에서 L-N·L-PE·N-PE 측정, 부하 유무 기록',
      '분전반 핸들 + 출력단 전압 확인',
      '살아 있는 마지막 지점 ~ 처음 죽은 지점 찾기',
      'OFF → 잠금·표시 → 검전지 무전압 확인',
      '부하 분리 후 메가(500V, 1MΩ 이상)',
      '도통시험 확정',
      '복구 후 전 콘센트 L-N 220V·전류·극성 재확인',
      '입주사 안내',
      '당직일지 기록',
    ],
  },
  mistakes: {
    title: '자주 하는 오판',
    items: [
      { wrong: '핸들이 ON이니 차단기는 정상', right: '출력단 전압을 직접 측정. 중간 위치 트립을 놓칠 수 있음.' },
      { wrong: '접지테스터 "이상" → 접지 불량', right: '전압 3종 값으로 확인. 접지 불량은 임의 연결 금지, 보고·기록.' },
      { wrong: '전등이 켜져 있으니 분전반 문제 아님', right: '전등과 전열은 회로가 다르다. 전열 회로 자체를 따로 확인.' },
      { wrong: '트립 → 바로 다시 올림', right: '원인 확인 먼저. 재투입은 완전 OFF 후 ON.' },
      { wrong: '메가를 부하 연결 상태에서 측정', right: 'SMPS·LED 드라이버·PC를 분리하고 500V 레인지로 측정. 1MΩ 이상 정상.' },
      { wrong: '램프만 교체', right: '제어계통(릴레이, DC24V 모듈, 타임스위치, BMS)을 확인.' },
      { wrong: '입주사 장비 문제까지 건물 설비로 처리', right: '전용부 경계(멀티탭, 자체 분전반, 교체 등기구)를 먼저 구분.' },
    ],
  },
  cases: {
    title: '사례 풀이',
    items: [
      {
        no: '#1', title: '15F 사무실 전열 전체 불통', branch: '가지 E',
        rows: [
          ['증상', '사무실 전열 전체가 한꺼번에 안 들어옴.'],
          ['핵심', '범위가 넓으니 상류(분전반)부터. 분기 ELB 핸들이 ON과 OFF 사이 중간 위치였음.'],
          ['조치', '원인 확인 후 완전 OFF → ON, 재트립 여부 확인, 입주사에 트립 직전 사용 장비 확인.'],
          ['교훈', '핸들이 애매하면 출력단 전압으로 확인하고, 재투입은 완전 OFF 후 ON.'],
        ],
      },
      {
        no: '#2', title: '23F 창가 한 줄 불통, 전날 이사', branch: '가지 B',
        rows: [
          ['증상', '같은 줄 PC 여섯 대 불통, 전등과 복도 쪽 콘센트는 정상.'],
          ['측정', '불통 콘센트 L-N 0V, L-PE 220V, N-PE 220V(부하 꽂힘), 분전반 출력단은 정상(220V).'],
          ['판단', '차단기 정상 + L-N 0V → N선 의심, 상류 N-PE 0V → 하류 220V로 바뀌는 지점 = 플로어박스 접속부.'],
          ['조치', 'OFF·잠금·검전지 → 접속부 확인 → N선 재결선 → 복전 후 전 콘센트 L-N 220V 확인.'],
          ['교훈', '이사·자리 변경 뒤에는 플로어박스 접속부를 의심한다.'],
        ],
      },
    ],
  },
  equipment: {
    title: '장비 정보',
    items: [
      { kind: '검전지', model: 'HIOKI 2512E', desc: '비접촉 AC 40~600V 저압 전용' },
      { kind: '클램프미터', model: 'HIOKI 3280-10F', desc: '' },
      { kind: '접지테스터', model: 'CHEKMAN TK-21', desc: '' },
      { kind: '메가', model: 'HIOKI IR4033', desc: '' },
    ],
  },
  points: {
    title: '외울 포인트',
    items: [
      '전압은 L-N, L-PE, N-PE를 같이 잰다.',
      '핸들이 ON이어도 출력단 전압으로 확인한다.',
      '항상 상류에서 하류로, 살아 있는 마지막 지점과 처음 죽은 지점 사이를 찾는다.',
      '작업 전에는 OFF, 잠금·표시, 검전지 무전압 확인.',
      '전압시험으로 좁히고 도통시험으로 확정한다.',
    ],
  },
};

export const FOOTER = '전기팀 현장용 · 보조용 가이드이며 현장 안전 규정이 우선입니다';
