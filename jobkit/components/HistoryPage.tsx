'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/client/api';
import { APPLICATION_STATUSES, type Application, type ApplicationStatus } from '@/lib/types';
import { digitsOnly, normalizeSite } from '@/lib/util/text';
import { Badge, Button, Card, Input, LinkButton, Notice, Select, Textarea } from './ui';

type ListItem = Omit<Application, 'posting_text' | 'parsed_json'>;

const STATUS_COLOR: Record<ApplicationStatus, 'gray' | 'blue' | 'purple' | 'orange' | 'green' | 'red'> = {
  작성중: 'gray',
  지원함: 'blue',
  연락옴: 'purple',
  면접: 'orange',
  합격: 'green',
  불합격: 'red',
  포기: 'gray',
};

export default function HistoryPage() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState<Application | null>(null);
  const [files, setFiles] = useState<{ resume: string; letter: string } | null>(null);
  const [memo, setMemo] = useState('');
  const [tab, setTab] = useState<'resume' | 'letter' | 'posting' | 'mail'>('posting');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function load() {
    try {
      const r = await api<{ applications: ListItem[] }>('/api/applications');
      setItems(r.applications);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  useEffect(() => {
    void load();
  }, []);

  // 검색은 브라우저에서만 (전화번호가 서버 로그에 남지 않게)
  const filtered = useMemo(() => {
    const t = q.trim();
    if (!t) return items;
    const d = digitsOnly(t);
    const s = normalizeSite(t);
    return items.filter(
      (a) =>
        (d.length >= 3 && digitsOnly(a.phone).includes(d)) ||
        normalizeSite(a.site).includes(s) ||
        normalizeSite(a.company).includes(s) ||
        a.emails.some((e) => e.includes(t.toLowerCase())),
    );
  }, [items, q]);

  async function open(id: number) {
    const r = await api<{ application: Application; files: { resume: string; letter: string } }>(`/api/applications/${id}`);
    setSelected(r.application);
    setFiles(r.files);
    setMemo(r.application.memo);
    setTab(r.application.resume_pdf_path ? 'resume' : 'posting');
    setSaved(false);
  }

  async function patch(id: number, p: Partial<Application>) {
    const r = await api<{ application: Application }>(`/api/applications/${id}`, { method: 'PATCH', json: p });
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));
    if (selected?.id === id) setSelected(r.application);
  }

  async function remove(id: number) {
    if (!confirm('이 지원 이력과 저장된 PDF를 삭제할까요? 되돌릴 수 없습니다.')) return;
    await api(`/api/applications/${id}`, { method: 'DELETE' });
    setSelected(null);
    await load();
  }

  return (
    <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] gap-6">
      <div className="min-w-0 space-y-3">
        <Card
          title="지원 이력"
          right={
            <LinkButton href="/api/applications/export" download>
              CSV 내보내기
            </LinkButton>
          }
        >
          <Input placeholder="전화번호 또는 단지명으로 검색 (예: 053-123-4567, 도남)" value={q} onChange={(e) => setQ(e.target.value)} />
          {error && (
            <div className="mt-2">
              <Notice level="danger">{error}</Notice>
            </div>
          )}
          <table className="mt-3 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-left text-xs text-gray-600">
                <th className="whitespace-nowrap p-2">날짜</th>
                <th className="p-2">단지</th>
                <th className="p-2">직책</th>
                <th className="p-2">위탁사</th>
                <th className="whitespace-nowrap p-2">전화</th>
                <th className="p-2">상태</th>
                <th className="p-2">메모</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  onClick={() => void open(a.id)}
                  className={`cursor-pointer border-b hover:bg-blue-50 ${selected?.id === a.id ? 'bg-blue-50' : ''}`}
                >
                  <td className="whitespace-nowrap p-2 text-xs">{a.created_at.slice(0, 10)}</td>
                  <td className="p-2">{a.site}</td>
                  <td className="p-2">{a.title}</td>
                  <td className="p-2 text-xs">{a.company}</td>
                  <td className="whitespace-nowrap p-2 text-xs">{a.phone}</td>
                  <td className="p-2" onClick={(e) => e.stopPropagation()}>
                    <Select value={a.status} onChange={(e) => void patch(a.id, { status: e.target.value as ApplicationStatus })} className="!px-1 !py-0.5 !text-xs">
                      {APPLICATION_STATUSES.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </Select>
                  </td>
                  <td className="max-w-[9rem] truncate p-2 text-xs text-gray-600">{a.memo}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-gray-500">
                    {items.length ? '검색 결과가 없습니다.' : '아직 지원 이력이 없습니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="min-w-0">
        <div className="sticky top-4">
          {selected ? (
            <Card
              title={
                <span>
                  {selected.site} <span className="font-normal text-gray-500">{selected.title}</span>{' '}
                  <Badge color={STATUS_COLOR[selected.status]}>{selected.status}</Badge>
                </span>
              }
              right={
                <Button variant="danger" onClick={() => void remove(selected.id)}>
                  삭제
                </Button>
              }
            >
              <div className="mb-3 grid grid-cols-2 gap-x-4 text-sm">
                <div>
                  <span className="text-gray-500">위탁사</span> {selected.company || '-'}
                </div>
                <div>
                  <span className="text-gray-500">전화</span> {selected.phone || '-'}
                </div>
                <div className="col-span-2">
                  <span className="text-gray-500">주소</span> {selected.address || '-'}
                </div>
                <div>
                  <span className="text-gray-500">마감</span> {selected.deadline || '-'}
                </div>
                <div>
                  <span className="text-gray-500">이메일</span> {selected.emails.join(', ') || '-'}
                </div>
              </div>
              <div className="mb-2 flex gap-1">
                {(
                  [
                    ['resume', '보낸 이력서'],
                    ['letter', '보낸 자기소개서'],
                    ['mail', '메일'],
                    ['posting', '공고 원문'],
                  ] as const
                ).map(([k, l]) => (
                  <Button key={k} variant={tab === k ? 'primary' : 'secondary'} onClick={() => setTab(k)}>
                    {l}
                  </Button>
                ))}
              </div>
              {(tab === 'resume' || tab === 'letter') &&
                (selected[tab === 'resume' ? 'resume_pdf_path' : 'letter_pdf_path'] ? (
                  <>
                    <iframe
                      key={`${selected.id}-${tab}`}
                      title="PDF"
                      src={`/api/applications/${selected.id}/file?kind=${tab}#view=FitH`}
                      className="h-[620px] w-full rounded border bg-gray-100"
                    />
                    <div className="mt-2 flex gap-2">
                      <LinkButton href={`/api/applications/${selected.id}/file?kind=${tab}&download=1`}>
                        {tab === 'resume' ? files?.resume : files?.letter} 다운로드
                      </LinkButton>
                    </div>
                  </>
                ) : (
                  <Notice>저장된 PDF가 없습니다.</Notice>
                ))}
              {tab === 'posting' && (
                <pre className="max-h-[620px] overflow-auto whitespace-pre-wrap rounded border bg-gray-50 p-3 text-sm">{selected.posting_text || '(원문 없음)'}</pre>
              )}
              {tab === 'mail' && (
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">받는 사람</span> {selected.selected_email ?? selected.emails[0] ?? '-'}
                  </div>
                  <div>
                    <span className="text-gray-500">제목</span> {selected.mail_subject}
                  </div>
                  <pre className="max-h-[560px] overflow-auto whitespace-pre-wrap rounded border bg-gray-50 p-3">{selected.mail_body}</pre>
                </div>
              )}
              <div className="mt-4">
                <div className="mb-1 text-xs font-medium text-gray-600">메모 (면접 일정, 통화 내용 등)</div>
                <Textarea rows={5} value={memo} onChange={(e) => (setMemo(e.target.value), setSaved(false))} />
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    variant="primary"
                    onClick={async () => {
                      await patch(selected.id, { memo });
                      setSaved(true);
                    }}
                  >
                    메모 저장
                  </Button>
                  {saved && <span className="text-xs text-green-700">저장됨</span>}
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="py-16 text-center text-sm text-gray-500">목록에서 지원 건을 누르면 보낸 서류와 공고 원문을 볼 수 있습니다.</div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
