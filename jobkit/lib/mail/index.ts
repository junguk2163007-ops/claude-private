import type { ParsedPosting } from '../parser';
import type { Profile, Settings } from '../types';
import { koreanDate } from '../util/date';

export function mailSubject(parsed: Pick<ParsedPosting, 'required_phrase' | 'site' | 'title'>, name: string): string {
  const rp = parsed.required_phrase?.trim();
  if (rp) return `${rp} - ${name}`;
  return `[${parsed.site.trim()}] ${parsed.title.trim()} 지원 - ${name}`;
}

export function signature(settings: Settings, profile: Pick<Profile, 'name' | 'phone' | 'email'>): string {
  return settings.mail_signature
    .replace(/\{name\}/g, profile.name)
    .replace(/\{phone\}/g, profile.phone)
    .replace(/\{email\}/g, profile.email)
    .trim();
}

export interface MailBodyInput {
  template: string;
  parsed: Pick<ParsedPosting, 'site' | 'title' | 'start_date'>;
  profile: Pick<Profile, 'name' | 'phone' | 'email'>;
  settings: Settings;
  /** 사용자가 체크한 추가 첨부 서류 (메일 문구용 on/off 일 뿐, 파일은 저장하지 않음) */
  extraDocs: string[];
}

export function mailBody({ template, parsed, profile, settings, extraDocs }: MailBodyInput): string {
  const start = parsed.start_date ? ` 안내해 주신 출근예정일(${koreanDate(parsed.start_date)})에도 맞춰 근무를 시작할 수 있습니다.` : '';
  const docs = extraDocs.map((d) => d.trim()).filter(Boolean);
  const docsText = docs.length ? ` 요청하신 ${docs.join(', ')}도 함께 첨부하였습니다.` : '';
  return template
    .replace(/\{site\}/g, parsed.site.trim())
    .replace(/\{title\}/g, parsed.title.trim())
    .replace(/\{START\}/g, start)
    .replace(/\{DOCS\}/g, docsText)
    .replace(/\{SIGNATURE\}/g, signature(settings, profile));
}

export function gmailComposeUrl(to: string, subject: string, body: string): string {
  const q = new URLSearchParams({ view: 'cm', fs: '1', to, su: subject, body });
  return `https://mail.google.com/mail/?${q.toString().replace(/\+/g, '%20')}`;
}

export function mailtoUrl(to: string, subject: string, body: string): string {
  const enc = (s: string) => encodeURIComponent(s.replace(/\r?\n/g, '\r\n'));
  return `mailto:${encodeURIComponent(to).replace(/%40/g, '@')}?subject=${enc(subject)}&body=${enc(body)}`;
}

/** 이메일 접수가 없고 고용24 등 다른 경로만 있는지 */
export function isPortalOnly(parsed: Pick<ParsedPosting, 'apply_channels' | 'emails'>): boolean {
  return parsed.emails.length === 0 && parsed.apply_channels.some((c) => c !== 'email');
}
