'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import type { ProfileCheck } from '@/lib/render/compose';
import { BARRIERS, type Barrier, type BlockKey, type Blocks, type Profile, type Qualification } from '@/lib/types';
import { Button, Card, Field, Input, ListInput, Notice, Select, Textarea } from './ui';

const BLOCK_GROUPS: { title: string; items: { key: BlockKey; label: string; help?: string }[] }[] = [
  { title: '성장과정', items: [{ key: 'growth', label: '성장과정 (고정)' }] },
  {
    title: '성격의 장점 및 보완점 = S1 + S2 + S3(변형) + S4',
    items: [
      { key: 'strength_s1', label: 'S1' },
      { key: 'strength_s2', label: 'S2' },
      { key: 'strength_s3_gyeogil', label: 'S3 — 격일 근무 공고' },
      { key: 'strength_s3_gyodae', label: 'S3 — 3교대/주야교대 공고' },
      { key: 'strength_s3_default', label: 'S3 — 상근/기타 공고' },
      { key: 'strength_s4', label: 'S4' },
    ],
  },
  {
    title: '직무 관련 경험',
    items: [
      { key: 'experience', label: '본문', help: '{sales_years} = 경력의 분양 기간(년) 자동 계산' },
      { key: 'experience_no_apt_prefix', label: '접두어', help: '공고의 아파트 근무 경력이 [필수]인데 미보유일 때 본문 앞에 붙습니다.' },
    ],
  },
  {
    title: '지원동기 = (근거리면 M1) + M2 + M3',
    items: [
      { key: 'motive_m1', label: 'M1 거리 문장', help: '주소가 근거리 지역 목록에 있을 때만 들어갑니다.' },
      { key: 'motive_m2', label: 'M2' },
      { key: 'motive_m3', label: 'M3 — 출근예정일 없을 때' },
      { key: 'motive_m3_start', label: 'M3 — 출근예정일 있을 때', help: '{start_date} = "2026년 10월 1일" 형식' },
    ],
  },
  {
    title: '입사 후 포부 = G1({GAP}) + G2',
    items: [
      { key: 'goal_g1', label: 'G1', help: '{GAP} 자리에 약속 가능한 미보유 자격 문구가 들어갑니다.' },
      { key: 'goal_gap_suffix', label: 'GAP 끝맺음', help: 'promise_phrase 뒤에 붙습니다. 여러 개면 "A하고, B" + 끝맺음.' },
      { key: 'goal_gap_default', label: 'GAP 기본 문구', help: '약속할 자격이 없을 때' },
      { key: 'goal_g2', label: 'G2' },
    ],
  },
  {
    title: '이력서 하단 "지원동기 및 자기소개" (고정 3문단)',
    items: [
      { key: 'resume_intro_1', label: '1문단' },
      { key: 'resume_intro_2', label: '2문단' },
      { key: 'resume_intro_3', label: '3문단' },
    ],
  },
  {
    title: '지원 메일 본문',
    items: [{ key: 'mail_body', label: '본문 템플릿', help: '{site} {title} {START}(출근예정일 문장) {DOCS}(추가 첨부 문장) {SIGNATURE}(설정의 서명)' }],
  },
];

const BARRIER_LABEL: Record<Barrier, string> = { none: '없음', low: '낮음', medium: '중간', high: '높음' };

function ListEditor<T extends object>({
  items,
  onChange,
  empty,
  render,
  addLabel,
}: {
  items: T[];
  onChange: (v: T[]) => void;
  empty: T;
  render: (item: T, set: (patch: Partial<T>) => void) => React.ReactNode;
  addLabel: string;
}) {
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-end gap-2 rounded border border-gray-100 bg-gray-50 p-2">
          <div className="grid flex-1 grid-cols-12 gap-2">{render(it, (p) => onChange(items.map((x, j) => (j === i ? { ...x, ...p } : x))))}</div>
          <div className="flex flex-col gap-1">
            <Button variant="ghost" disabled={i === 0} onClick={() => onChange(items.map((x, j) => (j === i - 1 ? items[i] : j === i ? items[i - 1] : x)))}>
              ↑
            </Button>
            <Button variant="danger" onClick={() => onChange(items.filter((_, j) => j !== i))}>
              삭제
            </Button>
          </div>
        </div>
      ))}
      <Button onClick={() => onChange([...items, { ...empty }])}>+ {addLabel}</Button>
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [check, setCheck] = useState<ProfileCheck | null>(null);
  const [blocks, setBlocks] = useState<Blocks | null>(null);
  const [quals, setQuals] = useState<Qualification[]>([]);
  const [photoV, setPhotoV] = useState(Date.now());
  const [msg, setMsg] = useState<{ section: string; text: string; level: 'ok' | 'warn' | 'danger' } | null>(null);

  useEffect(() => {
    void (async () => {
      const [p, b, q] = await Promise.all([
        api<{ profile: Profile; check: ProfileCheck }>('/api/profile'),
        api<{ blocks: Blocks }>('/api/blocks'),
        api<{ qualifications: Qualification[] }>('/api/qualifications'),
      ]);
      setProfile(p.profile);
      setCheck(p.check);
      setBlocks(b.blocks);
      setQuals(q.qualifications);
    })();
  }, []);

  if (!profile || !blocks) return <div className="text-sm text-gray-500">불러오는 중…</div>;

  const setP = (patch: Partial<Profile>) => setProfile({ ...profile, ...patch });
  const say = (section: string, text: string, level: 'ok' | 'warn' | 'danger' = 'ok') => setMsg({ section, text, level });
  const Msg = ({ section }: { section: string }) => (msg?.section === section ? <Notice level={msg.level}>{msg.text}</Notice> : null);

  async function saveProfile() {
    try {
      const { photo_file: _p, ...data } = profile!;
      const r = await api<{ profile: Profile; check: ProfileCheck }>('/api/profile', { method: 'PUT', json: data });
      setProfile(r.profile);
      setCheck(r.check);
      say('profile', r.check.required.length ? `저장했습니다. 필수 항목이 비어 있습니다: ${r.check.required.join(', ')}` : '저장했습니다.', r.check.required.length ? 'warn' : 'ok');
    } catch (e) {
      say('profile', (e as Error).message, 'danger');
    }
  }

  async function uploadPhoto(file: File) {
    const fd = new FormData();
    fd.append('photo', file);
    try {
      const r = await api<{ check: ProfileCheck }>('/api/profile/photo', { method: 'POST', body: fd });
      setCheck(r.check);
      setP({ photo_file: 'set' });
      setPhotoV(Date.now());
      say('photo', '사진을 저장했습니다.');
    } catch (e) {
      say('photo', (e as Error).message, 'danger');
    }
  }

  async function deletePhoto() {
    const r = await api<{ check: ProfileCheck }>('/api/profile/photo', { method: 'DELETE' });
    setCheck(r.check);
    setP({ photo_file: null });
    say('photo', '사진을 삭제했습니다.', 'warn');
  }

  async function saveBlocks() {
    try {
      await api('/api/blocks', { method: 'PUT', json: blocks });
      say('blocks', '문구를 저장했습니다. 다음 서류 생성부터 적용됩니다.');
    } catch (e) {
      say('blocks', (e as Error).message, 'danger');
    }
  }

  async function saveQuals(list = quals) {
    try {
      const bad = list.find((q) => !q.name.trim());
      if (bad) return say('quals', '이름이 빈 항목이 있습니다.', 'danger');
      const r = await api<{ qualifications: Qualification[] }>('/api/qualifications', { method: 'PUT', json: list });
      setQuals(r.qualifications);
      say('quals', '저장했습니다. 분석·판정·포부 문구에 바로 반영됩니다.');
    } catch (e) {
      say('quals', (e as Error).message, 'danger');
    }
  }

  const req = new Set(check?.required ?? []);

  return (
    <div className="space-y-6">
      {check && check.required.length > 0 && <Notice level="warn">필수 입력이 비어 있습니다: {check.required.join(', ')}</Notice>}
      <div className="grid grid-cols-2 gap-6">
        <div className="min-w-0 space-y-4">
          <Card title="인적사항" right={<Button variant="primary" onClick={saveProfile}>프로필 저장</Button>}>
            <Notice level="info">주민등록번호·계좌번호는 입력받지 않습니다. 생년월일까지만 저장합니다.</Notice>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field label="이름 *" warn={req.has('이름')}>
                <Input value={profile.name} onChange={(e) => setP({ name: e.target.value })} warn={req.has('이름')} />
              </Field>
              <Field label="생년월일 *" warn={req.has('생년월일')}>
                <Input type="date" value={profile.birth} onChange={(e) => setP({ birth: e.target.value })} warn={req.has('생년월일')} />
              </Field>
              <Field label="연락처 *" warn={req.has('연락처')}>
                <Input value={profile.phone} onChange={(e) => setP({ phone: e.target.value })} warn={req.has('연락처')} />
              </Field>
              <Field label="이메일 *" warn={req.has('이메일')}>
                <Input value={profile.email} onChange={(e) => setP({ email: e.target.value })} warn={req.has('이메일')} />
              </Field>
              <Field label="주소 *" className="col-span-2" warn={req.has('주소')}>
                <Input value={profile.address} onChange={(e) => setP({ address: e.target.value })} warn={req.has('주소')} />
              </Field>
            </div>
            <div className="mt-2">
              <Msg section="profile" />
            </div>
          </Card>

          <Card title="학력">
            <ListEditor
              items={profile.education}
              onChange={(education) => setP({ education })}
              empty={{ school: '', status: '졸업', major: '', start: '', end: '' }}
              addLabel="학력 추가"
              render={(e, set) => (
                <>
                  <Field label="학교명" className="col-span-4">
                    <Input value={e.school} onChange={(x) => set({ school: x.target.value })} />
                  </Field>
                  <Field label="전공" className="col-span-2">
                    <Input value={e.major} onChange={(x) => set({ major: x.target.value })} />
                  </Field>
                  <Field label="입학연월" className="col-span-2">
                    <Input placeholder="YYYY-MM" value={e.start} onChange={(x) => set({ start: x.target.value })} />
                  </Field>
                  <Field label="졸업연월" className="col-span-2">
                    <Input placeholder="YYYY-MM" value={e.end} onChange={(x) => set({ end: x.target.value })} />
                  </Field>
                  <Field label="구분" className="col-span-2">
                    <Input value={e.status} onChange={(x) => set({ status: x.target.value })} />
                  </Field>
                </>
              )}
            />
            <div className="mt-1 text-xs text-gray-500">마지막 줄이 이력서의 &quot;최종학력&quot;으로 표시됩니다.</div>
          </Card>

          <Card title="병역">
            <div className="grid grid-cols-3 gap-3">
              {(
                [
                  ['branch', '군별'],
                  ['corps', '병과'],
                  ['rank', '계급'],
                ] as const
              ).map(([k, l]) => (
                <Field key={k} label={l}>
                  <Input value={profile.military[k]} onChange={(e) => setP({ military: { ...profile.military, [k]: e.target.value } })} />
                </Field>
              ))}
              <Field label="입대연월">
                <Input type="month" value={profile.military.start} onChange={(e) => setP({ military: { ...profile.military, start: e.target.value } })} />
              </Field>
              <Field label="전역연월">
                <Input type="month" value={profile.military.end} onChange={(e) => setP({ military: { ...profile.military, end: e.target.value } })} />
              </Field>
              <Field label="전역구분">
                <Input value={profile.military.discharge} onChange={(e) => setP({ military: { ...profile.military, discharge: e.target.value } })} />
              </Field>
            </div>
          </Card>

          <Card title="자격 및 면허 (이력서 표)">
            <ListEditor
              items={profile.licenses}
              onChange={(licenses) => setP({ licenses })}
              empty={{ name: '', issuer: '', date: '' }}
              addLabel="자격 추가"
              render={(l, set) => (
                <>
                  <Field label="자격/면허명" className="col-span-5">
                    <Input value={l.name} onChange={(x) => set({ name: x.target.value })} />
                  </Field>
                  <Field label="발급기관" className="col-span-4" warn={!l.issuer.trim()}>
                    <Input value={l.issuer} onChange={(x) => set({ issuer: x.target.value })} warn={!l.issuer.trim()} />
                  </Field>
                  <Field label="취득 (YYYY 또는 YYYY-MM)" className="col-span-3" warn={!l.date.trim()}>
                    <Input value={l.date} onChange={(x) => set({ date: x.target.value })} />
                  </Field>
                </>
              )}
            />
            <div className="mt-1 text-xs text-gray-500">빈 칸은 PDF에 &quot;-&quot;로 표시됩니다. 분석용 보유 여부는 아래 &quot;보유 자격/경력 목록&quot;에서 관리합니다.</div>
          </Card>

          <Card title="경력 (입력 순서대로 이력서에 표시)">
            <ListEditor
              items={profile.careers}
              onChange={(careers) => setP({ careers })}
              empty={{ start: '', end: '', company: '', duties: '' }}
              addLabel="경력 추가"
              render={(c, set) => (
                <>
                  <Field label="시작 (YYYY)" className="col-span-2">
                    <Input value={c.start} onChange={(x) => set({ start: x.target.value })} />
                  </Field>
                  <Field label="종료 (YYYY)" className="col-span-2">
                    <Input value={c.end} onChange={(x) => set({ end: x.target.value })} />
                  </Field>
                  <Field label="근무처" className="col-span-3">
                    <Input value={c.company} onChange={(x) => set({ company: x.target.value })} />
                  </Field>
                  <Field label="담당업무" className="col-span-12">
                    <Textarea rows={2} value={c.duties} onChange={(x) => set({ duties: x.target.value })} />
                  </Field>
                </>
              )}
            />
            <div className="mt-3 flex justify-end">
              <Button variant="primary" onClick={saveProfile}>
                프로필 저장
              </Button>
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-4">
          <Card title="증명사진 (3×4cm 비율)">
            <div className="flex items-start gap-4">
              <div className="flex h-[160px] w-[120px] items-center justify-center overflow-hidden border border-dashed border-gray-400 bg-gray-50 text-xs text-gray-500">
                {profile.photo_file ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/photo?v=${photoV}`} alt="증명사진" className="h-full w-full object-cover" />
                ) : (
                  '사진 없음'
                )}
              </div>
              <div className="space-y-2 text-sm">
                <label className="inline-block cursor-pointer rounded border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-gray-50">
                  {profile.photo_file ? '사진 바꾸기' : '사진 선택'}
                  <input
                    type="file"
                    className="hidden"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void uploadPhoto(f);
                    }}
                  />
                </label>
                <div className="text-xs text-gray-500">JPG/PNG/WEBP, 5MB 이하. 3:4 비율이 아니면 가운데를 잘라 넣습니다. 사진은 로그인한 상태에서만 볼 수 있습니다.</div>
                {profile.photo_file && (
                  <Button variant="danger" onClick={() => void deletePhoto()}>
                    사진 삭제
                  </Button>
                )}
                <Msg section="photo" />
              </div>
            </div>
          </Card>

          <Card title="보유 자격/경력 목록 (분석·포부 문구 기준)" right={<Button variant="primary" onClick={() => void saveQuals()}>목록 저장</Button>}>
            <div className="mb-2 text-xs text-gray-500">
              &quot;보유&quot;를 바꾸면 즉시 저장되어 분석 판정과 자소서 포부 문구가 바로 바뀝니다. 약속 가능(promisable) 항목만 &quot;취득 예정&quot;으로 자소서에 들어갑니다.
            </div>
            <div className="space-y-2">
              {quals.map((q, i) => {
                const set = (patch: Partial<Qualification>) => setQuals(quals.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <div key={q.id ?? `new-${i}`} className={`rounded border p-2 ${q.have ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-white'}`}>
                    <div className="grid grid-cols-12 gap-2">
                      <Field label="이름" className="col-span-4">
                        <Input value={q.name} onChange={(e) => set({ name: e.target.value })} />
                      </Field>
                      <Field label="보유" className="col-span-2">
                        <label className="flex items-center gap-1 py-1.5 text-sm">
                          <input
                            type="checkbox"
                            checked={q.have}
                            onChange={(e) => {
                              const next = quals.map((x, j) => (j === i ? { ...x, have: e.target.checked } : x));
                              setQuals(next);
                              void saveQuals(next);
                            }}
                          />
                          {q.have ? '보유' : '미보유'}
                        </label>
                      </Field>
                      <Field label="장벽" className="col-span-2">
                        <Select value={q.barrier} onChange={(e) => set({ barrier: e.target.value as Barrier })}>
                          {BARRIERS.map((b) => (
                            <option key={b} value={b}>
                              {BARRIER_LABEL[b]}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="약속 가능" className="col-span-2">
                        <label className="flex items-center gap-1 py-1.5 text-sm">
                          <input type="checkbox" checked={q.promisable} onChange={(e) => set({ promisable: e.target.checked })} />
                          {q.promisable ? '예' : '아니오'}
                        </label>
                      </Field>
                      <div className="col-span-2 flex items-end justify-end">
                        <Button variant="danger" onClick={() => setQuals(quals.filter((_, j) => j !== i))}>
                          삭제
                        </Button>
                      </div>
                      <Field label="별칭 (쉼표로 구분, 공고에서 이 말이 나오면 매칭)" className="col-span-12">
                        <ListInput value={q.aliases} onChange={(aliases) => set({ aliases })} />
                      </Field>
                      {q.promisable && (
                        <Field label="포부 문구 (뒤에 '하여 업무 전문성을…'이 붙음)" className="col-span-12">
                          <Input value={q.promise_phrase} onChange={(e) => set({ promise_phrase: e.target.value })} />
                        </Field>
                      )}
                      <Field label="비고/힌트 (분석 표에만 표시)" className="col-span-12">
                        <Input value={q.hint} onChange={(e) => set({ hint: e.target.value })} />
                      </Field>
                    </div>
                  </div>
                );
              })}
              <Button
                onClick={() =>
                  setQuals([...quals, { id: 0, key: null, name: '', aliases: [], have: false, barrier: 'medium', promisable: false, promise_phrase: '', hint: '' }])
                }
              >
                + 항목 추가
              </Button>
              <Msg section="quals" />
            </div>
          </Card>
        </div>
      </div>

      <Card title="자기소개서·이력서·메일 문구 블록" right={<Button variant="primary" onClick={saveBlocks}>문구 저장</Button>}>
        <Notice level="info">
          블록에는 사실만 적으세요. 공고마다 바뀌는 것은 아래 변형 슬롯뿐입니다. <b>**굵게**</b> 로 감싼 부분은 PDF에서 굵은 진한 파랑으로 표시됩니다.
        </Notice>
        <div className="mt-3 grid grid-cols-2 gap-6">
          {BLOCK_GROUPS.map((g) => (
            <div key={g.title} className="space-y-2">
              <h3 className="text-sm font-bold text-[#1F4E79]">{g.title}</h3>
              {g.items.map((it) => (
                <Field key={it.key} label={it.label} hint={it.help}>
                  <Textarea
                    rows={it.key === 'mail_body' ? 14 : 3}
                    value={blocks[it.key]}
                    onChange={(e) => setBlocks({ ...blocks, [it.key]: e.target.value })}
                  />
                </Field>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Msg section="blocks" />
          <Button variant="primary" onClick={saveBlocks}>
            문구 저장
          </Button>
        </div>
      </Card>
    </div>
  );
}
