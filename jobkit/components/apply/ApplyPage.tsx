'use client';

import { useEffect, useRef, useState } from 'react';
import type { Analysis } from '@/lib/analyze';
import type { ParsedPosting } from '@/lib/parser';
import type { ProfileCheck } from '@/lib/render/compose';
import type { Application } from '@/lib/types';
import { EXTRA_DOC_OPTIONS } from '@/lib/types';
import { api } from '@/lib/client/api';
import { Button, Card, Input, Notice, Textarea } from '../ui';
import ParsedForm from './ParsedForm';
import { RequirementsTable, SignalCard, SummaryCard, WarningsList } from './AnalysisPanel';
import ResultPanel, { type GeneratedInfo } from './ResultPanel';

interface AnalyzeRes {
  parsed: ParsedPosting;
  analysis: Analysis;
  profileCheck: ProfileCheck;
  today: string;
}

interface GenerateRes {
  application: Application;
  resumePages: number;
  letterPages: number;
  resumeFontPt: number;
  warnings: string[];
  profileCheck: ProfileCheck;
  files: GeneratedInfo['files'];
}

export default function ApplyPage() {
  const [text, setText] = useState('');
  const [analyzedText, setAnalyzedText] = useState('');
  const [parsed, setParsed] = useState<ParsedPosting | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [profileCheck, setProfileCheck] = useState<ProfileCheck | null>(null);
  const [extra, setExtra] = useState<Record<string, boolean>>({});
  const [otherOn, setOtherOn] = useState(false);
  const [otherText, setOtherText] = useState('');
  const [busy, setBusy] = useState<'analyze' | 'generate' | 'record' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gen, setGen] = useState<GeneratedInfo | null>(null);
  const [app, setApp] = useState<Application | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const reanalyzeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reqSeq = useRef(0);

  async function doAnalyze() {
    if (!text.trim()) return;
    setBusy('analyze');
    setError(null);
    try {
      const r = await api<AnalyzeRes>('/api/analyze', { method: 'POST', json: { text } });
      setParsed(r.parsed);
      setAnalysis(r.analysis);
      setProfileCheck(r.profileCheck);
      setAnalyzedText(text);
      setGen(null);
      setApp(null);
      setExtra({ '자격증 사본': r.parsed.submit_docs.includes('자격증 사본') });
      setOtherOn(false);
      setOtherText('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  // 폼을 고치면 분석을 다시 돌린다 (디바운스)
  function updateParsed(p: ParsedPosting) {
    setParsed(p);
    if (reanalyzeTimer.current) clearTimeout(reanalyzeTimer.current);
    reanalyzeTimer.current = setTimeout(async () => {
      const seq = ++reqSeq.current;
      try {
        const r = await api<AnalyzeRes>('/api/analyze', {
          method: 'POST',
          json: { text: analyzedText, parsed: p, applicationId: app?.id ?? null },
        });
        if (seq === reqSeq.current) setAnalysis(r.analysis);
      } catch {
        /* 무시: 다음 입력 때 다시 시도 */
      }
    }, 400);
  }

  useEffect(() => () => {
    if (reanalyzeTimer.current) clearTimeout(reanalyzeTimer.current);
  }, []);

  const extraDocs = [...EXTRA_DOC_OPTIONS.filter((d) => extra[d]), ...(otherOn && otherText.trim() ? [otherText.trim()] : [])];

  async function doGenerate() {
    if (!parsed) return;
    if (!parsed.site.trim() || !parsed.title.trim()) {
      setError('단지/사업장명과 직책을 먼저 입력하세요.');
      return;
    }
    setBusy('generate');
    setError(null);
    try {
      const r = await api<GenerateRes>('/api/generate', {
        method: 'POST',
        json: { text: analyzedText, parsed, extraDocs, applicationId: app?.id ?? null },
      });
      setApp(r.application);
      setSubject(r.application.mail_subject);
      setBody(r.application.mail_body);
      setProfileCheck(r.profileCheck);
      setGen({
        applicationId: r.application.id,
        version: Date.now(),
        resumePages: r.resumePages,
        letterPages: r.letterPages,
        resumeFontPt: r.resumeFontPt,
        warnings: r.warnings,
        files: r.files,
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function saveMail(patch: Record<string, unknown> = {}) {
    if (!app) return;
    const r = await api<{ application: Application }>(`/api/applications/${app.id}`, {
      method: 'PATCH',
      json: { mail_subject: subject, mail_body: body, selected_email: app.selected_email, ...patch },
    });
    setApp(r.application);
  }

  async function record() {
    if (!app) return;
    setBusy('record');
    try {
      await saveMail({ status: '지원함' });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-6">
      <div className="min-w-0 space-y-4">
        <Card title="1. 공고 붙여넣기">
          <Textarea
            rows={12}
            placeholder="채용 공고 내용을 통째로 붙여넣으세요."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-2">
            <Button variant="primary" onClick={doAnalyze} disabled={!text.trim() || busy === 'analyze'}>
              {busy === 'analyze' ? '분석 중…' : '분석'}
            </Button>
            {parsed && text !== analyzedText && <span className="text-xs text-amber-700">원문이 바뀌었습니다. 다시 [분석]을 누르세요.</span>}
          </div>
        </Card>

        {error && <Notice level="danger">{error}</Notice>}

        {parsed && analysis && (
          <>
            <Card title="2. 공고 정보 확인·수정" right={<span className="text-xs text-gray-500">고치면 분석이 바로 갱신됩니다</span>}>
              <ParsedForm value={parsed} onChange={updateParsed} />
            </Card>
            <SummaryCard parsed={parsed} />
            <RequirementsTable rows={analysis.rows} />
            <SignalCard signal={analysis.signal} />
            <WarningsList warnings={analysis.warnings} />

            <Card title="3. 서류 생성">
              <div className="mb-3">
                <div className="mb-1 text-xs font-medium text-gray-600">추가 첨부 서류 (메일 본문 문구용 체크. 파일은 저장하지 않습니다)</div>
                <div className="flex flex-wrap items-center gap-4">
                  {EXTRA_DOC_OPTIONS.map((d) => (
                    <label key={d} className="flex items-center gap-1 text-sm">
                      <input type="checkbox" checked={!!extra[d]} onChange={(e) => setExtra({ ...extra, [d]: e.target.checked })} />
                      {d}
                    </label>
                  ))}
                  <label className="flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={otherOn} onChange={(e) => setOtherOn(e.target.checked)} />
                    기타
                  </label>
                  {otherOn && <Input className="!w-48" placeholder="예: 경력증명서" value={otherText} onChange={(e) => setOtherText(e.target.value)} />}
                </div>
              </div>
              {profileCheck && profileCheck.required.length > 0 && (
                <div className="mb-2">
                  <Notice level="warn">
                    프로필 필수 항목이 비어 있습니다: <b>{profileCheck.required.join(', ')}</b>. 생성은 되지만 PDF에는 &quot;-&quot;(사진은 빈 칸)으로 나옵니다.{' '}
                    <a className="underline" href="/profile">
                      프로필 입력
                    </a>
                  </Notice>
                </div>
              )}
              {profileCheck && profileCheck.optional.length > 0 && (
                <div className="mb-2 text-xs text-gray-500">PDF에 &quot;-&quot;로 표시될 빈 항목: {profileCheck.optional.join(', ')}</div>
              )}
              {(!parsed.site.trim() || !parsed.title.trim()) && (
                <div className="mb-2">
                  <Notice level="warn">단지/사업장명과 직책을 입력해야 서류를 만들 수 있습니다.</Notice>
                </div>
              )}
              <Button variant="primary" className="px-6 py-2 text-base" onClick={doGenerate} disabled={busy === 'generate'}>
                {busy === 'generate' ? '생성 중…' : gen ? '서류 다시 생성' : '서류 생성'}
              </Button>
            </Card>
          </>
        )}
      </div>

      <div className="min-w-0">
        <div className="sticky top-4">
          {gen && parsed && app ? (
            <ResultPanel
              gen={gen}
              parsed={parsed}
              subject={subject}
              body={body}
              selectedEmail={app.selected_email}
              status={app.status}
              onSubject={setSubject}
              onBody={setBody}
              onSelectEmail={(e) => {
                setApp({ ...app, selected_email: e });
                void saveMail({ selected_email: e });
              }}
              onSaveMail={() => void saveMail()}
              onRecord={record}
              recording={busy === 'record'}
            />
          ) : (
            <Card>
              <div className="py-20 text-center text-sm text-gray-500">
                공고를 붙여넣고 [분석] → 내용 확인 → [서류 생성]을 누르면
                <br />
                여기에 이력서·자기소개서 미리보기와 지원 메일이 나타납니다.
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
