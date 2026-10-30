'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [pw, setPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) });
    setBusy(false);
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.href = next && next.startsWith('/') && !next.startsWith('//') ? next : '/apply';
      return;
    }
    const d = await res.json().catch(() => ({}));
    setError(d.error ?? '로그인에 실패했습니다.');
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form onSubmit={submit} className="w-80 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-[#1F4E79]">jobkit</h1>
        <p className="mb-4 text-sm text-gray-500">구직 서류 자동 생성</p>
        <label className="mb-1 block text-xs text-gray-600" htmlFor="pw">
          비밀번호
        </label>
        <input
          id="pw"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="mb-3 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        {error && <div className="mb-3 rounded border border-red-200 bg-red-50 px-2 py-1 text-sm text-red-800">{error}</div>}
        <button disabled={busy || !pw} className="w-full rounded bg-[#1F4E79] py-2 text-sm font-medium text-white disabled:bg-gray-400">
          {busy ? '확인 중…' : '로그인'}
        </button>
      </form>
    </div>
  );
}
