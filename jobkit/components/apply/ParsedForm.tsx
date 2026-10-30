'use client';

import type { ParsedPosting } from '@/lib/parser';
import { SHIFTS, type Shift } from '@/lib/types';
import { Field, Input, ListInput, Select } from '../ui';

const CHANNELS = ['email', '고용24', '잡코리아', '사람인', '방문', '우편', '팩스'];
const CHANNEL_LABEL: Record<string, string> = { email: '이메일' };

export default function ParsedForm({ value, onChange }: { value: ParsedPosting; onChange: (p: ParsedPosting) => void }) {
  const set = <K extends keyof ParsedPosting>(k: K, v: ParsedPosting[K]) => onChange({ ...value, [k]: v });

  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="단지/사업장명 *" warn={!value.site.trim()}>
        <Input value={value.site} onChange={(e) => set('site', e.target.value)} warn={!value.site.trim()} />
      </Field>
      <Field label="직책 *" warn={!value.title.trim()}>
        <Input value={value.title} onChange={(e) => set('title', e.target.value)} warn={!value.title.trim()} />
      </Field>
      <Field
        label="필수 기재 문구 (이력서 상단·메일 제목에 글자 그대로)"
        className="col-span-2"
        hint={value.required_phrase ? undefined : `비어 있으면 "${value.site} ${value.title} 지원" 으로 표기합니다. 공고에 필수 문구가 있는데 못 찾았다면 직접 입력하세요.`}
      >
        <Input value={value.required_phrase ?? ''} onChange={(e) => set('required_phrase', e.target.value || null)} />
      </Field>
      <Field label="위탁사명">
        <Input value={value.company} onChange={(e) => set('company', e.target.value)} />
      </Field>
      <Field label="총세대수">
        <Input
          type="number"
          value={value.households ?? ''}
          onChange={(e) => set('households', e.target.value ? parseInt(e.target.value, 10) : null)}
        />
      </Field>
      <Field label="주소" className="col-span-2" warn={!value.address.trim()}>
        <Input value={value.address} onChange={(e) => set('address', e.target.value)} />
      </Field>
      <Field label="급여 (공고 표기 그대로)">
        <Input value={value.salary_text} onChange={(e) => set('salary_text', e.target.value)} />
      </Field>
      <Field label="근무형태">
        <Select value={value.shift} onChange={(e) => set('shift', e.target.value as Shift)}>
          {SHIFTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </Field>
      <Field label="근무시간 문구">
        <Input value={value.shift_text} onChange={(e) => set('shift_text', e.target.value)} />
      </Field>
      <Field label="휴게시간">
        <Input value={value.break_time} onChange={(e) => set('break_time', e.target.value)} />
      </Field>
      <Field label="마감일 (채용시까지면 비움)">
        <Input type="date" value={value.deadline ?? ''} onChange={(e) => set('deadline', e.target.value || null)} />
      </Field>
      <Field label="출근예정일">
        <Input type="date" value={value.start_date ?? ''} onChange={(e) => set('start_date', e.target.value || null)} />
      </Field>
      <Field label="이메일 (쉼표로 구분)">
        <ListInput value={value.emails} onChange={(v) => set('emails', v)} />
      </Field>
      <Field label="연락처 (담당자/근무처)">
        <Input value={value.phone} onChange={(e) => set('phone', e.target.value)} />
      </Field>
      <Field label="제출서류 (쉼표로 구분)" className="col-span-2">
        <ListInput value={value.submit_docs} onChange={(v) => set('submit_docs', v)} />
      </Field>
      <Field label="접수방식" className="col-span-2">
        <div className="flex flex-wrap gap-3 py-1">
          {CHANNELS.map((c) => (
            <label key={c} className="flex items-center gap-1 text-sm">
              <input
                type="checkbox"
                checked={value.apply_channels.includes(c)}
                onChange={(e) =>
                  set('apply_channels', e.target.checked ? [...value.apply_channels, c] : value.apply_channels.filter((x) => x !== c))
                }
              />
              {CHANNEL_LABEL[c] ?? c}
            </label>
          ))}
        </div>
      </Field>
      <Field label="수습/평가 문구" className="col-span-2">
        <Input value={value.flags.probation ?? ''} onChange={(e) => set('flags', { probation: e.target.value || null })} />
      </Field>
    </div>
  );
}
