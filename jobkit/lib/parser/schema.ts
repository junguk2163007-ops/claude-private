import { z } from 'zod';
import { SHIFTS } from '../types';
import type { ParsedPosting } from './index';

const str = z.string().max(2000).default('');
const nullableDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .nullable()
  .or(z.literal('').transform(() => null))
  .default(null);

/** 화면의 수정 가능한 파싱 폼 값 검증 */
export const ParsedSchema = z.object({
  site: str,
  title: str,
  company: str,
  address: str,
  households: z.number().int().nullable().default(null),
  salary_text: str,
  salary_amount: z.number().nullable().default(null),
  shift: z.enum(SHIFTS).default('기타'),
  shift_text: str,
  break_time: str,
  emails: z.array(z.string().max(200)).max(10).default([]),
  phone: str,
  phones: z.array(z.string().max(50)).max(20).default([]),
  deadline: nullableDate,
  deadline_text: str,
  start_date: nullableDate,
  required_phrase: z
    .string()
    .max(200)
    .nullable()
    .transform((v) => (v && v.trim() ? v : null))
    .default(null),
  submit_docs: z.array(z.string().max(100)).max(30).default([]),
  apply_channels: z.array(z.string().max(30)).max(10).default([]),
  flags: z.object({ probation: z.string().max(500).nullable().default(null) }).default({ probation: null }),
  requirements: z
    .array(z.object({ line: z.string(), section: z.string().nullable(), category: z.enum(['우대', '필수(명시)', '완화', '필수로 보임']) }))
    .default([]),
}) satisfies z.ZodType<ParsedPosting, z.ZodTypeDef, unknown>;
