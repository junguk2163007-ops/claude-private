import { listApplications } from '@/lib/db/repo';
import { handler } from '@/lib/server/http';
import { contentDisposition } from '@/lib/util/filename';
import { todaySeoul } from '@/lib/util/date';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function cell(v: unknown): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // 스프레드시트 수식 주입 방지
  return `"${s.replace(/"/g, '""')}"`;
}

export const GET = handler(async () => {
  const header = ['날짜', '단지/사업장', '직책', '위탁사', '주소', '전화', '이메일', '마감일', '근무형태', '급여', '상태', '메모', '메일 제목'];
  const rows = listApplications().map((a) =>
    [a.created_at, a.site, a.title, a.company, a.address, a.phone, a.emails.join(' '), a.deadline ?? '', a.shift, a.salary_text, a.status, a.memo, a.mail_subject]
      .map(cell)
      .join(','),
  );
  const csv = '﻿' + [header.map(cell).join(','), ...rows].join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': contentDisposition(`지원이력_${todaySeoul()}.csv`, 'attachment', `applications-${todaySeoul()}.csv`),
      'Cache-Control': 'private, no-store',
    },
  });
});
