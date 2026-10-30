// Playwright(Chromium)로 HTML 을 A4 PDF 로 렌더링한다.
// 폰트는 assets/fonts 의 로컬 파일만 쓰고, 그 밖의 모든 네트워크 요청은 차단한다.

import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Browser } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { fontsDir } from '../paths';
import { type Level, levelCss, RENDER_ORIGIN, FONT_FAMILY } from './templates';

const g = globalThis as unknown as { __jobkitBrowser?: Promise<Browser>; __jobkitFonts?: Map<string, Buffer> };

function fontFile(name: string): Buffer | null {
  if (!/^[A-Za-z0-9-]+\.ttf$/.test(name)) return null;
  g.__jobkitFonts ??= new Map();
  let buf = g.__jobkitFonts.get(name);
  if (!buf) {
    const p = path.join(fontsDir(), name);
    if (!fs.existsSync(p)) return null;
    buf = fs.readFileSync(p);
    g.__jobkitFonts.set(name, buf);
  }
  return buf;
}

async function getBrowser(): Promise<Browser> {
  if (g.__jobkitBrowser) {
    const b = await g.__jobkitBrowser.catch(() => null);
    if (b && b.isConnected()) return b;
  }
  const executablePath = process.env.CHROMIUM_PATH || undefined;
  g.__jobkitBrowser = chromium.launch({ headless: true, executablePath });
  const b = await g.__jobkitBrowser;
  b.on('disconnected', () => {
    g.__jobkitBrowser = undefined;
  });
  return b;
}

export async function closeBrowser() {
  const b = await g.__jobkitBrowser?.catch(() => null);
  g.__jobkitBrowser = undefined;
  await b?.close();
}

export async function countPdfPages(pdf: Uint8Array): Promise<number> {
  const doc = await PDFDocument.load(pdf);
  return doc.getPageCount();
}

export interface FitResult {
  pdf: Buffer;
  pages: number;
  level: Level;
  /** 최소 단계까지 줄여도 목표 쪽수를 넘으면 true */
  overflow: boolean;
}

/**
 * levels 를 차례로 적용해 maxPages 안에 들어오는 첫 결과를 돌려준다.
 * 끝까지 넘치면 마지막(가장 작은) 단계 결과와 overflow=true.
 */
export async function renderFitted(html: string, levels: Level[], maxPages: number): Promise<FitResult> {
  const browser = await getBrowser();
  const context = await browser.newContext({ javaScriptEnabled: true, offline: false });
  try {
    const page = await context.newPage();
    await page.route('**/*', async (route) => {
      const url = route.request().url();
      if (url === `${RENDER_ORIGIN}/doc`) {
        return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: html });
      }
      if (url.startsWith(`${RENDER_ORIGIN}/fonts/`)) {
        const f = fontFile(url.slice(`${RENDER_ORIGIN}/fonts/`.length));
        if (f) return route.fulfill({ status: 200, contentType: 'font/ttf', body: f });
      }
      if (url.startsWith('data:')) return route.continue();
      return route.abort();
    });
    await page.goto(`${RENDER_ORIGIN}/doc`, { waitUntil: 'load' });
    await page.emulateMedia({ media: 'print' });
    const fontsOk = await page.evaluate(async (family) => {
      await document.fonts.load(`400 12px '${family}'`, '가');
      await document.fonts.load(`700 12px '${family}'`, '가');
      await document.fonts.ready;
      return document.fonts.check(`400 12px '${family}'`, '가') && document.fonts.check(`700 12px '${family}'`, '가');
    }, FONT_FAMILY);
    if (!fontsOk) throw new Error('한글 폰트를 불러오지 못했습니다 (assets/fonts 확인)');

    let last: FitResult | null = null;
    for (const level of levels) {
      await page.evaluate((css) => {
        const el = document.getElementById('level');
        if (el) el.textContent = css;
      }, levelCss(level));
      const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true });
      const pages = await countPdfPages(pdf);
      last = { pdf, pages, level, overflow: pages > maxPages };
      if (pages <= maxPages) return last;
    }
    return last!;
  } finally {
    await context.close();
  }
}
