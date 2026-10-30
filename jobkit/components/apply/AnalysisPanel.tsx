'use client';

import type { Analysis, ReqRow, Verdict } from '@/lib/analyze';
import type { Category, ParsedPosting } from '@/lib/parser';
import { koreanDate } from '@/lib/util/date';
import { Badge, Card, Notice } from '../ui';

const CAT_COLOR: Record<Category, 'blue' | 'purple' | 'green' | 'orange'> = {
  우대: 'blue',
  '필수(명시)': 'purple',
  완화: 'green',
  '필수로 보임': 'orange',
};
const VERDICT_COLOR: Record<Verdict, 'green' | 'yellow' | 'red' | 'gray'> = {
  충족: 'green',
  '미충족-보완가능': 'yellow',
  '미충족-장벽': 'red',
  '직접 확인': 'gray',
};
const SHIFT_COLOR = { 격일: 'red', '3교대': 'orange', 주야교대: 'orange', 상근: 'green', 기타: 'gray' } as const;
const CHANNEL_LABEL: Record<string, string> = { email: '이메일' };

function naverMap(address: string) {
  return `https://map.naver.com/p/search/${encodeURIComponent(address)}`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2 py-1 text-sm">
      <div className="w-20 shrink-0 text-gray-500">{label}</div>
      <div className="min-w-0 flex-1">{children || <span className="text-gray-400">-</span>}</div>
    </div>
  );
}

export function SummaryCard({ parsed }: { parsed: ParsedPosting }) {
  return (
    <Card title="공고 요약">
      <div className="grid grid-cols-2 gap-x-6">
        <Row label="단지">{parsed.site}</Row>
        <Row label="직책">{parsed.title}</Row>
        <Row label="위탁사">{parsed.company}</Row>
        <Row label="세대수">{parsed.households ? `${parsed.households.toLocaleString()}세대` : ''}</Row>
        <div className="col-span-2">
          <Row label="주소">
            {parsed.address && (
              <>
                {parsed.address}{' '}
                <a className="ml-1 text-xs text-[#1F4E79] underline" href={naverMap(parsed.address)} target="_blank" rel="noreferrer noopener">
                  네이버지도
                </a>
              </>
            )}
          </Row>
        </div>
        <Row label="급여">{parsed.salary_text}</Row>
        <Row label="근무형태">
          <Badge color={SHIFT_COLOR[parsed.shift]}>{parsed.shift}</Badge>
          {parsed.shift_text && <span className="ml-2 text-gray-600">{parsed.shift_text}</span>}
          {parsed.break_time && <span className="ml-2 text-gray-500">휴게 {parsed.break_time}</span>}
        </Row>
        <Row label="마감일">{parsed.deadline ? koreanDate(parsed.deadline) : parsed.deadline_text || '채용시까지/미기재'}</Row>
        <Row label="출근예정일">{parsed.start_date ? koreanDate(parsed.start_date) : ''}</Row>
        <Row label="접수방식">{parsed.apply_channels.map((c) => CHANNEL_LABEL[c] ?? c).join(', ')}</Row>
        <Row label="연락처">{parsed.phone}</Row>
        <div className="col-span-2">
          <Row label="이메일">{parsed.emails.join(', ')}</Row>
          <Row label="제출서류">{parsed.submit_docs.join(', ')}</Row>
        </div>
      </div>
    </Card>
  );
}

export function RequirementsTable({ rows }: { rows: ReqRow[] }) {
  return (
    <Card title="요건 비교표">
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500">자격/경력 요건으로 보이는 줄을 찾지 못했습니다. 공고를 직접 확인하세요.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs text-gray-600">
              <th className="whitespace-nowrap p-2">구분</th>
              <th className="p-2">공고 문구</th>
              <th className="p-2">매칭 항목</th>
              <th className="whitespace-nowrap p-2">판정</th>
              <th className="p-2">비고</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className={`border-b align-top ${r.verdict === '직접 확인' ? 'bg-gray-50 text-gray-500' : ''}`}>
                <td className="p-2">
                  <Badge color={CAT_COLOR[r.category]}>{r.category}</Badge>
                </td>
                <td className="p-2">{r.line}</td>
                <td className="p-2">{r.qualification_name ?? '-'}</td>
                <td className="p-2">
                  <Badge color={VERDICT_COLOR[r.verdict]}>{r.verdict}</Badge>
                </td>
                <td className="max-w-[14rem] p-2 text-xs text-gray-600">{r.hint}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

export function SignalCard({ signal }: { signal: Analysis['signal'] }) {
  const color = { green: 'bg-green-500', yellow: 'bg-amber-400', red: 'bg-red-500' }[signal.level];
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="flex gap-1.5 pt-1">
          {(['green', 'yellow', 'red'] as const).map((l) => (
            <span key={l} className={`h-4 w-4 rounded-full ${l === signal.level ? color : 'bg-gray-200'}`} />
          ))}
        </div>
        <div>
          <div className="font-bold">{signal.title}</div>
          <div className="text-sm text-gray-700">{signal.detail}</div>
          <div className="mt-1 text-xs text-gray-500">분석은 참고용입니다. 결과와 관계없이 서류 생성과 지원은 항상 가능합니다.</div>
        </div>
      </div>
    </Card>
  );
}

export function WarningsList({ warnings }: { warnings: Analysis['warnings'] }) {
  if (!warnings.length) return null;
  return (
    <div className="space-y-2">
      {warnings.map((w, i) => (
        <Notice key={i} level={w.level}>
          {w.text}
        </Notice>
      ))}
    </div>
  );
}
