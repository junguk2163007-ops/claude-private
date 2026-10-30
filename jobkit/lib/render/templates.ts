// 인쇄용 HTML 템플릿. 흰 배경, 얇은 회색 테두리, 라벨 칸 연회색. 장식 없음.
// PDF 에는 "확인 필요" 같은 임시 문구나 빨간 글씨를 넣지 않는다. 빈 값은 "-".

import { escapeHtml } from '../util/text';
import type { LetterData, ResumeData } from './compose';

export const FONT_FAMILY = 'JobkitNotoSansKR';
export const RENDER_ORIGIN = 'http://jobkit.render';

export interface Level {
  /** 본문 글자 크기(pt) */
  fs: number;
  /** 페이지 여백(mm) */
  pad: number;
  /** 줄 간격 */
  lh: number;
  /** 섹션 간격(mm) */
  gap: number;
}

const dash = (v: string | null | undefined) => (v && v.trim() ? escapeHtml(v.trim()) : '-');

/** **굵게** → 굵게 + 진한 파랑 */
export function inlineMarkup(text: string): string {
  return escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong class="em">$1</strong>').replace(/\*\*/g, '');
}

/** 단계별로 바뀌는 CSS. PDF 렌더러가 <style id="level"> 내용만 교체하며 맞춘다. */
export function levelCss(level: Level): string {
  return `@page { size: A4; margin: ${level.pad}mm; } :root { --fs: ${level.fs}pt; --lh: ${level.lh}; --gap: ${level.gap}mm; }`;
}

function baseCss(): string {
  return `
@font-face { font-family: '${FONT_FAMILY}'; src: url('${RENDER_ORIGIN}/fonts/NotoSansKR-Regular.ttf') format('truetype'); font-weight: 400; font-style: normal; }
@font-face { font-family: '${FONT_FAMILY}'; src: url('${RENDER_ORIGIN}/fonts/NotoSansKR-Bold.ttf') format('truetype'); font-weight: 700; font-style: normal; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: #fff; }
body { font-family: '${FONT_FAMILY}', sans-serif; color: #111; font-size: var(--fs); line-height: var(--lh);
  word-break: keep-all; overflow-wrap: anywhere; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
h1.title { text-align: center; font-size: 20pt; font-weight: 700; letter-spacing: 0.4em; margin: 0 0 2mm; padding-left: 0.4em; }
.target { text-align: center; font-size: 12.5pt; font-weight: 700; color: #0B2A4A; margin: 0 0 calc(var(--gap) + 1mm); }
h2 { font-size: calc(var(--fs) + 1pt); font-weight: 700; margin: var(--gap) 0 1.5mm; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th, td { border: 0.6pt solid #9ca3af; padding: 1.3mm 2mm; vertical-align: middle; text-align: left; font-weight: 400; }
th { background: #f1f3f5; font-weight: 700; text-align: center; }
td.c { text-align: center; }
strong.em { font-weight: 700; color: #1F4E79; }
p { margin: 0; }
`;
}

function doc(title: string, css: string, body: string, level: Level): string {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${css}</style><style id="level">${levelCss(
    level,
  )}</style></head><body>${body}</body></html>`;
}

export function resumeHtml(d: ResumeData, level: Level, photoDataUri: string | null): string {
  const css =
    baseCss() +
    `
.info th { width: 24mm; }
.info td.photo { width: 34mm; padding: 1.5mm; text-align: center; vertical-align: middle; }
.photo-box { width: 30mm; height: 40mm; margin: 0 auto; display: flex; align-items: center; justify-content: center; }
.photo-box img { width: 30mm; height: 40mm; object-fit: cover; display: block; }
.photo-box.empty { border: 0.8pt dashed #9ca3af; color: #6b7280; font-size: 9pt; }
.info td { height: 7.2mm; }
.intro { border: 0.6pt solid #9ca3af; padding: 2.5mm 3mm; }
.intro p + p { margin-top: 1.5mm; }
.sign { margin-top: calc(var(--gap) + 1mm); text-align: center; }
.sign .date { margin-top: 2mm; }
.sign .who { margin-top: 3mm; text-align: right; font-size: calc(var(--fs) + 1pt); }
col.c-period { width: 32mm; }
`;
  const photo = photoDataUri
    ? `<div class="photo-box"><img src="${photoDataUri}" alt=""></div>`
    : `<div class="photo-box empty">사진 부착</div>`;

  const edu = d.education.length
    ? d.education
        .map(
          (e, i) =>
            `<tr><td class="c">${i === d.education.length - 1 ? '최종학력' : '학력'}</td><td>${dash(e.school)}${
              e.major ? ` (${escapeHtml(e.major)})` : ''
            }</td><td class="c">${dash(e.start)}</td><td class="c">${dash(e.end)}</td><td class="c">${dash(e.status)}</td></tr>`,
        )
        .join('')
    : `<tr><td class="c">-</td><td>-</td><td class="c">-</td><td class="c">-</td><td class="c">-</td></tr>`;

  const mil = d.military
    ? `<tr><td class="c">${dash(d.military.branchCorps)}</td><td class="c">${dash(d.military.rank)}</td><td class="c">${dash(
        d.military.period,
      )}</td><td class="c">${dash(d.military.discharge)}</td></tr>`
    : `<tr><td class="c">-</td><td class="c">-</td><td class="c">-</td><td class="c">-</td></tr>`;

  const lic = d.licenses.length
    ? d.licenses.map((l) => `<tr><td>${dash(l.name)}</td><td class="c">${dash(l.issuer)}</td><td class="c">${dash(l.date)}</td></tr>`).join('')
    : `<tr><td>-</td><td class="c">-</td><td class="c">-</td></tr>`;

  const car = d.careers.length
    ? d.careers.map((c) => `<tr><td class="c">${dash(c.period)}</td><td class="c">${dash(c.company)}</td><td>${dash(c.duties)}</td></tr>`).join('')
    : `<tr><td class="c">-</td><td class="c">-</td><td>-</td></tr>`;

  const body = `<div class="page">
<h1 class="title">이 력 서</h1>
<div class="target">${escapeHtml(d.target)}</div>
<table class="info">
<tr><th>성명</th><td>${dash(d.name)}</td><td class="photo" rowspan="6">${photo}</td></tr>
<tr><th>생년월일</th><td>${dash(d.birth)}</td></tr>
<tr><th>연락처</th><td>${dash(d.phone)}</td></tr>
<tr><th>이메일</th><td>${dash(d.email)}</td></tr>
<tr><th>주소</th><td>${dash(d.address)}</td></tr>
<tr><th>지원분야</th><td>${dash(d.applyField)}</td></tr>
</table>
<h2>학력사항</h2>
<table><colgroup><col style="width:22mm"><col><col style="width:26mm"><col style="width:26mm"><col style="width:22mm"></colgroup>
<tr><th>구분</th><th>학교명</th><th>입학연월</th><th>졸업연월</th><th>졸업구분</th></tr>${edu}</table>
<h2>병역사항</h2>
<table><tr><th>군별 / 병과</th><th>계급</th><th>복무기간</th><th>전역구분</th></tr>${mil}</table>
<h2>자격 및 면허사항</h2>
<table><colgroup><col><col style="width:40mm"><col style="width:30mm"></colgroup>
<tr><th>자격/면허명</th><th>발급기관</th><th>취득일자</th></tr>${lic}</table>
<h2>경력사항</h2>
<table><colgroup><col class="c-period"><col style="width:30mm"><col></colgroup>
<tr><th>근무기간</th><th>근무처</th><th>담당업무</th></tr>${car}</table>
<h2>지원동기 및 자기소개</h2>
<div class="intro">${d.intro.map((p) => `<p>${inlineMarkup(p)}</p>`).join('')}</div>
<div class="sign">
<div>위 내용은 사실과 다름이 없습니다.</div>
<div class="date">${dash(d.date)}</div>
<div class="who">지원자&nbsp;&nbsp;${escapeHtml(d.signName)}&nbsp;&nbsp;(인)</div>
</div>
</div>`;
  return doc(`이력서`, css, body, level);
}

export function letterHtml(d: LetterData, level: Level): string {
  const css =
    baseCss() +
    `
.applicant { text-align: right; margin: 0 0 calc(var(--gap) - 1mm); font-size: calc(var(--fs) + 0.5pt); }
section { break-inside: auto; }
section h2 { border-bottom: 1pt solid #111; padding-bottom: 1mm; margin-top: var(--gap); }
section p { text-align: left; }
`;
  const body = `<div class="page">
<h1 class="title">자 기 소 개 서</h1>
<div class="target">${escapeHtml(d.target)}</div>
<div class="applicant">지원자 ${dash(d.name)}</div>
${d.sections.map((s) => `<section><h2>${escapeHtml(s.title)}</h2><p>${inlineMarkup(s.text)}</p></section>`).join('\n')}
</div>`;
  return doc('자기소개서', css, body, level);
}
