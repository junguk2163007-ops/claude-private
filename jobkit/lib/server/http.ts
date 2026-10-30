import { NextResponse } from 'next/server';
import { ZodError } from 'zod';

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function errorJson(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * 라우트 핸들러 래퍼. 로그에는 에러 종류만 남긴다
 * (이름·연락처·공고 원문 등 요청 데이터는 절대 로그에 쓰지 않는다).
 */
export function handler<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ZodError) return errorJson('입력값 형식이 올바르지 않습니다.', 400);
      const name = e instanceof Error ? e.name : 'Error';
      console.error(`[jobkit] request failed: ${name}`);
      return errorJson('처리 중 오류가 발생했습니다.', 500);
    }
  };
}

export function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}
