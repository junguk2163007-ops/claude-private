// SQLite 스키마. 개인정보 최소화: 주민등록번호, 계좌번호, 등본/통장 사본 컬럼은 없다.
// (tests/schema.test.ts 가 이 원칙을 검사한다)

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  name TEXT NOT NULL DEFAULT '',
  birth TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  education_json TEXT NOT NULL DEFAULT '[]',
  military_json TEXT NOT NULL DEFAULT '{}',
  licenses_json TEXT NOT NULL DEFAULT '[]',
  careers_json TEXT NOT NULL DEFAULT '[]',
  photo_file TEXT,
  updated_at TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS qualifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT,
  name TEXT NOT NULL,
  aliases_json TEXT NOT NULL DEFAULT '[]',
  have INTEGER NOT NULL DEFAULT 0,
  barrier TEXT NOT NULL DEFAULT 'none' CHECK (barrier IN ('none','low','medium','high')),
  promisable INTEGER NOT NULL DEFAULT 0,
  promise_phrase TEXT NOT NULL DEFAULT '',
  hint TEXT NOT NULL DEFAULT '',
  sort INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS blocks (
  key TEXT PRIMARY KEY,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  site TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  company TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  emails TEXT NOT NULL DEFAULT '[]',
  deadline TEXT,
  shift TEXT NOT NULL DEFAULT '',
  salary_text TEXT NOT NULL DEFAULT '',
  required_phrase TEXT,
  posting_text TEXT NOT NULL DEFAULT '',
  parsed_json TEXT NOT NULL DEFAULT '{}',
  resume_pdf_path TEXT,
  letter_pdf_path TEXT,
  mail_subject TEXT NOT NULL DEFAULT '',
  mail_body TEXT NOT NULL DEFAULT '',
  selected_email TEXT,
  extra_docs TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT '작성중'
    CHECK (status IN ('작성중','지원함','연락옴','면접','합격','불합격','포기')),
  memo TEXT NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_applications_created ON applications(created_at);
`;
