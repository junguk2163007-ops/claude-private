import { z } from 'zod';

// 개인정보 최소화 원칙: 주민등록번호·계좌번호·등본·통장 사본을 담는 필드는 만들지 않는다.
// 모든 스키마는 .strict() 로 알 수 없는 키를 거부한다.

export const EducationSchema = z
  .object({
    school: z.string().default(''),
    status: z.string().default(''), // 졸업, 수료, 중퇴 등
    major: z.string().default(''),
    start: z.string().default(''), // YYYY-MM
    end: z.string().default(''),
  })
  .strict();

export const MilitarySchema = z
  .object({
    branch: z.string().default(''), // 군별 (육군)
    corps: z.string().default(''), // 병과 (수색대)
    rank: z.string().default(''), // 계급
    start: z.string().default(''),
    end: z.string().default(''),
    discharge: z.string().default(''), // 전역구분 (만기제대)
  })
  .strict();

export const LicenseSchema = z
  .object({
    name: z.string().default(''),
    issuer: z.string().default(''),
    date: z.string().default(''), // YYYY 또는 YYYY-MM 또는 YYYY-MM-DD
  })
  .strict();

export const CareerSchema = z
  .object({
    start: z.string().default(''),
    end: z.string().default(''),
    company: z.string().default(''),
    duties: z.string().default(''),
  })
  .strict();

export const ProfileSchema = z
  .object({
    name: z.string().default(''),
    birth: z.string().default(''), // YYYY-MM-DD (생년월일까지만 저장)
    phone: z.string().default(''),
    email: z.string().default(''),
    address: z.string().default(''),
    education: z.array(EducationSchema).default([]),
    military: MilitarySchema.default({}),
    licenses: z.array(LicenseSchema).default([]),
    careers: z.array(CareerSchema).default([]),
  })
  .strict();

export type Education = z.infer<typeof EducationSchema>;
export type Military = z.infer<typeof MilitarySchema>;
export type License = z.infer<typeof LicenseSchema>;
export type Career = z.infer<typeof CareerSchema>;
export type ProfileData = z.infer<typeof ProfileSchema>;
export type Profile = ProfileData & { photo_file: string | null };

export const BARRIERS = ['none', 'low', 'medium', 'high'] as const;
export type Barrier = (typeof BARRIERS)[number];

export const QualificationSchema = z
  .object({
    id: z.number().int().optional(),
    key: z.string().nullable().default(null), // 내부 역할 키 (예: apt_exp = 아파트 근무 경력)
    name: z.string().min(1),
    aliases: z.array(z.string()).default([]),
    have: z.boolean().default(false),
    barrier: z.enum(BARRIERS).default('none'),
    promisable: z.boolean().default(false),
    promise_phrase: z.string().default(''),
    hint: z.string().default(''),
  })
  .strict();
export type Qualification = z.infer<typeof QualificationSchema> & { id: number };

export const SettingsSchema = z
  .object({
    near_keywords: z.array(z.string()).default(['북구', '칠곡', '침산', '구암', '관음', '국우', '도남']),
    mail_signature: z.string().default('{name} 드림\n{phone}'),
  })
  .strict();
export type Settings = z.infer<typeof SettingsSchema>;

export const BLOCK_KEYS = [
  'growth',
  'strength_s1',
  'strength_s2',
  'strength_s3_gyeogil',
  'strength_s3_gyodae',
  'strength_s3_default',
  'strength_s4',
  'experience',
  'experience_no_apt_prefix',
  'motive_m1',
  'motive_m2',
  'motive_m3',
  'motive_m3_start',
  'goal_g1',
  'goal_gap_default',
  'goal_gap_suffix',
  'goal_g2',
  'resume_intro_1',
  'resume_intro_2',
  'resume_intro_3',
  'mail_body',
] as const;
export type BlockKey = (typeof BLOCK_KEYS)[number];
export type Blocks = Record<BlockKey, string>;

export const BlocksSchema = z.object(
  Object.fromEntries(BLOCK_KEYS.map((k) => [k, z.string()])) as Record<BlockKey, z.ZodString>,
).strict();

export const APPLICATION_STATUSES = ['작성중', '지원함', '연락옴', '면접', '합격', '불합격', '포기'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const SHIFTS = ['격일', '3교대', '주야교대', '상근', '기타'] as const;
export type Shift = (typeof SHIFTS)[number];

export const EXTRA_DOC_OPTIONS = ['자격증 사본', '주민등록등본', '통장 사본'] as const;

export interface Application {
  id: number;
  created_at: string;
  updated_at: string;
  site: string;
  title: string;
  company: string;
  address: string;
  phone: string;
  emails: string[];
  deadline: string | null;
  shift: string;
  salary_text: string;
  required_phrase: string | null;
  posting_text: string;
  parsed_json: string;
  resume_pdf_path: string | null;
  letter_pdf_path: string | null;
  mail_subject: string;
  mail_body: string;
  selected_email: string | null;
  extra_docs: string[];
  status: ApplicationStatus;
  memo: string;
}
