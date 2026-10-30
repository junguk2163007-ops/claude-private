'use client';

import { useState } from 'react';
import { gmailComposeUrl, isPortalOnly, mailtoUrl } from '@/lib/mail';
import type { ParsedPosting } from '@/lib/parser';
import { copyText } from '@/lib/client/api';
import { Badge, Button, Card, Field, Input, LinkButton, Notice, Textarea } from '../ui';

export interface GeneratedInfo {
  applicationId: number;
  version: number;
  resumePages: number;
  letterPages: number;
  resumeFontPt: number;
  warnings: string[];
  files: { resume: string; letter: string; zip: string };
}

interface Props {
  gen: GeneratedInfo;
  parsed: ParsedPosting;
  subject: string;
  body: string;
  selectedEmail: string | null;
  status: string;
  onSubject: (s: string) => void;
  onBody: (s: string) => void;
  onSelectEmail: (s: string) => void;
  onSaveMail: () => void;
  onRecord: () => void;
  recording: boolean;
}

export default function ResultPanel(p: Props) {
  const [tab, setTab] = useState<'resume' | 'letter'>('resume');
  const [copied, setCopied] = useState<string | null>(null);
  const base = `/api/applications/${p.gen.applicationId}/file`;
  const v = `&v=${p.gen.version}`;
  const portalOnly = isPortalOnly(p.parsed);
  const to = p.selectedEmail ?? p.parsed.emails[0] ?? '';

  async function copy(label: string, text: string) {
    if (await copyText(text)) {
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    }
  }

  return (
    <div className="space-y-4">
      <Card
        title="생성된 서류"
        right={
          <div className="flex gap-1">
            <Button variant={tab === 'resume' ? 'primary' : 'secondary'} onClick={() => setTab('resume')}>
              이력서 ({p.gen.resumePages}쪽)
            </Button>
            <Button variant={tab === 'letter' ? 'primary' : 'secondary'} onClick={() => setTab('letter')}>
              자기소개서 ({p.gen.letterPages}쪽)
            </Button>
          </div>
        }
      >
        {p.gen.warnings.map((w, i) => (
          <div key={i} className="mb-2">
            <Notice level="warn">{w}</Notice>
          </div>
        ))}
        <iframe
          key={`${tab}-${p.gen.version}`}
          title={tab === 'resume' ? '이력서 미리보기' : '자기소개서 미리보기'}
          src={`${base}?kind=${tab}${v}#view=FitH`}
          className="h-[760px] w-full rounded border border-gray-200 bg-gray-100"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          <LinkButton href={`${base}?kind=resume&download=1${v}`} variant="primary">
            이력서 PDF 다운로드
          </LinkButton>
          <LinkButton href={`${base}?kind=letter&download=1${v}`} variant="primary">
            자기소개서 PDF 다운로드
          </LinkButton>
          <LinkButton href={`${base}?kind=zip${v}`}>두 파일 zip</LinkButton>
          <span className="self-center text-xs text-gray-500">이력서 본문 {p.gen.resumeFontPt}pt</span>
        </div>
        <div className="mt-1 text-xs text-gray-500">
          파일명: {p.gen.files.resume} / {p.gen.files.letter}
        </div>
      </Card>

      <Card title="지원 메일">
        {portalOnly ? (
          <Notice level="info">
            이 공고는 이메일 접수가 없습니다({p.parsed.apply_channels.join(', ')}). 해당 사이트에서 직접 지원하고, 다운로드한 PDF를 첨부하세요.
          </Notice>
        ) : (
          <div className="space-y-3">
            {p.parsed.emails.length > 1 && (
              <Field label="수신 주소 선택">
                <div className="flex flex-wrap gap-4 py-1">
                  {p.parsed.emails.map((e) => (
                    <label key={e} className="flex items-center gap-1 text-sm">
                      <input type="radio" name="to" checked={to === e} onChange={() => p.onSelectEmail(e)} />
                      {e}
                    </label>
                  ))}
                </div>
              </Field>
            )}
            {p.parsed.emails.length === 0 && <Notice level="warn">공고에서 이메일 주소를 찾지 못했습니다. 왼쪽 폼에 직접 입력하세요.</Notice>}
            <Field label={`받는 사람: ${to || '-'}`}>
              <span />
            </Field>
            <Field label="제목">
              <Input value={p.subject} onChange={(e) => p.onSubject(e.target.value)} onBlur={p.onSaveMail} />
            </Field>
            <Field label="본문">
              <Textarea rows={16} value={p.body} onChange={(e) => p.onBody(e.target.value)} onBlur={p.onSaveMail} />
            </Field>
            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={() => copy('subject', p.subject)}>{copied === 'subject' ? '복사됨 ✓' : '제목 복사'}</Button>
              <Button onClick={() => copy('body', p.body)}>{copied === 'body' ? '복사됨 ✓' : '본문 복사'}</Button>
              <Button onClick={() => copy('to', to)} disabled={!to}>
                {copied === 'to' ? '복사됨 ✓' : '수신 주소 복사'}
              </Button>
              <LinkButton href={gmailComposeUrl(to, p.subject, p.body)} target="_blank" variant="primary">
                Gmail 새 메일 열기
              </LinkButton>
              <LinkButton href={mailtoUrl(to, p.subject, p.body)}>기본 메일앱</LinkButton>
            </div>
            <Notice level="warn">
              첨부파일은 브라우저가 자동으로 넣을 수 없습니다. <b>PDF를 다운로드한 뒤 메일에 직접 첨부하세요.</b>
            </Notice>
          </div>
        )}
      </Card>

      <Card>
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={p.onRecord} disabled={p.recording || p.status !== '작성중'}>
            지원함으로 기록
          </Button>
          <span className="text-sm text-gray-600">
            현재 상태 <Badge color={p.status === '작성중' ? 'gray' : 'green'}>{p.status}</Badge>
          </span>
          {p.status !== '작성중' && <span className="text-sm text-gray-500">지원 이력에 기록되었습니다. 서류를 다시 만들면 새 건으로 저장됩니다.</span>}
        </div>
      </Card>
    </div>
  );
}
