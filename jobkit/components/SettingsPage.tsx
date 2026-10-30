'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/client/api';
import type { Settings } from '@/lib/types';
import { Button, Card, Field, Notice, Textarea } from './ui';

export default function SettingsPage() {
  const [s, setS] = useState<Settings | null>(null);
  const [kw, setKw] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void api<{ settings: Settings }>('/api/settings').then((r) => {
      setS(r.settings);
      setKw(r.settings.near_keywords.join('\n'));
    });
  }, []);

  if (!s) return <div className="text-sm text-gray-500">불러오는 중…</div>;

  async function save() {
    const near_keywords = kw
      .split(/[\n,]/)
      .map((x) => x.trim())
      .filter(Boolean);
    const r = await api<{ settings: Settings }>('/api/settings', { method: 'PUT', json: { ...s, near_keywords } });
    setS(r.settings);
    setKw(r.settings.near_keywords.join('\n'));
    setMsg('저장했습니다.');
  }

  return (
    <div className="grid max-w-5xl grid-cols-2 gap-6">
      <Card title="근거리 지역 키워드">
        <Field label="한 줄에 하나씩 (주소에 이 말이 들어 있으면 근거리)" hint="근거리일 때만 자소서 지원동기에 거리 문장(M1)이 들어가고, 아니면 '통근 거리 직접 확인' 경고가 뜹니다.">
          <Textarea rows={10} value={kw} onChange={(e) => setKw(e.target.value)} />
        </Field>
      </Card>
      <Card title="메일 서명">
        <Field label="메일 본문 맨 끝 {SIGNATURE} 자리에 들어갑니다" hint="{name} {phone} {email} 은 프로필 값으로 바뀝니다.">
          <Textarea rows={4} value={s.mail_signature} onChange={(e) => setS({ ...s, mail_signature: e.target.value })} />
        </Field>
      </Card>
      <Card title="비밀번호" className="col-span-2">
        <div className="space-y-1 text-sm text-gray-700">
          <p>
            로그인 비밀번호는 화면에서 바꾸지 않고 서버 환경변수 <code className="rounded bg-gray-100 px-1">APP_PASSWORD</code> 로 정합니다.
          </p>
          <p>
            바꾸려면 <code className="rounded bg-gray-100 px-1">.env.local</code>(로컬) 또는 배포 플랫폼의 Secrets(Fly.io: <code>fly secrets set APP_PASSWORD=…</code>, Railway: Variables)에서 값을 바꾸고 앱을 다시 시작하세요.
            <code className="rounded bg-gray-100 px-1">SESSION_SECRET</code> 도 바꾸면 기존 로그인 세션이 모두 끊깁니다.
          </p>
          <p>로그인은 15분에 5번까지 틀릴 수 있고, 그 이상은 잠시 막힙니다.</p>
        </div>
      </Card>
      <div className="col-span-2 flex items-center gap-3">
        <Button variant="primary" onClick={() => void save()}>
          설정 저장
        </Button>
        {msg && <Notice level="ok">{msg}</Notice>}
      </div>
    </div>
  );
}
