import { describe, expect, it } from 'vitest';
import { unzipSync } from 'fflate';
import { contentDisposition, docFileName, sanitizeFilePart } from '@/lib/util/filename';
import { makeZip } from '@/lib/util/zip';

describe('한글 파일명 다운로드 헤더', () => {
  it('파일명 정리 (특수문자·공백)', () => {
    expect(docFileName('이력서', '정민욱', '힐스테이트데시앙 도남3단지', 'pdf')).toBe('이력서_정민욱_힐스테이트데시앙_도남3단지.pdf');
    expect(docFileName('자기소개서', '정민욱', '동우/힐스테이트데시앙도남2단지', 'pdf')).toBe('자기소개서_정민욱_동우_힐스테이트데시앙도남2단지.pdf');
    expect(sanitizeFilePart('수성알파시티청아람 / 관리주임')).toBe('수성알파시티청아람_관리주임');
    expect(sanitizeFilePart('a:b*c?"d<e>f|g\\h')).toBe('a_b_c_d_e_f_g_h');
    expect(sanitizeFilePart('')).toBe('지원처');
  });

  it('Content-Disposition 에 filename* (RFC 5987, UTF-8)', () => {
    const name = '이력서_정민욱_힐스테이트데시앙_도남3단지.pdf';
    const h = contentDisposition(name, 'attachment');
    expect(h.startsWith('attachment; filename="')).toBe(true);
    const star = h.match(/filename\*=UTF-8''(.+)$/)![1];
    expect(decodeURIComponent(star)).toBe(name);
    expect(/^[\x20-\x7e]+$/.test(h)).toBe(true); // 헤더 값은 ASCII 만
    const fallback = h.match(/filename="([^"]+)"/)![1];
    expect(fallback.endsWith('.pdf')).toBe(true);
    expect(contentDisposition('a b(1).pdf', 'inline')).toContain("filename*=UTF-8''a%20b%281%29.pdf");
  });

  it('Response 헤더로 왕복해도 한글 파일명이 유지된다', () => {
    const name = '자기소개서_정민욱_칠곡수정한양아파트.pdf';
    const res = new Response('x', { headers: { 'Content-Disposition': contentDisposition(name) } });
    const v = res.headers.get('content-disposition')!;
    expect(decodeURIComponent(v.split("filename*=UTF-8''")[1])).toBe(name);
  });

  it('zip 안의 한글 파일명', () => {
    const zip = makeZip([
      { name: '이력서_정민욱_테스트.pdf', data: new Uint8Array([1, 2, 3]) },
      { name: '자기소개서_정민욱_테스트.pdf', data: new Uint8Array([4, 5]) },
    ]);
    const out = unzipSync(new Uint8Array(zip));
    expect(Object.keys(out).sort()).toEqual(['이력서_정민욱_테스트.pdf', '자기소개서_정민욱_테스트.pdf'].sort());
    // 로컬 파일 헤더의 범용 플래그 bit 11 (UTF-8) 확인
    expect(zip.readUInt16LE(6) & 0x0800).toBe(0x0800);
  });
});

describe('ASCII 대체 이름', () => {
  it('명시한 대체 이름을 쓴다', () => {
    expect(contentDisposition('이력서_정민욱.pdf', 'attachment', 'resume-3.pdf')).toMatch(/^attachment; filename="resume-3.pdf"; filename\*=UTF-8''/);
  });
  it('한글만 있으면 document.pdf', () => {
    expect(contentDisposition('이력서_정민욱_3단지.pdf')).toContain('filename="document.pdf"');
  });
});
