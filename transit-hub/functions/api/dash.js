import routes from '../../config.json';
import fastExit from '../../data/fast-exit.json';
import { buildDash } from '../../lib/dash.js';

const HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-robots-tag': 'noindex, nofollow',
  'x-content-type-options': 'nosniff',
};

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

export async function onRequestGet({ request, env }) {
  const id = new URL(request.url).searchParams.get('route');
  // 사용자 입력은 config 의 id 목록과 "비교"만 한다 (경로·파일명으로 쓰지 않음).
  const route = id == null || id === '' ? routes[0] : routes.find((r) => r.id === id);
  if (!route) return json({ error: 'unknown route', routes: routes.map((r) => ({ id: r.id, label: r.label })) }, 404);

  try {
    return json(await buildDash({ route, routes, fastExit, env }));
  } catch {
    // 키·URL 이 섞일 수 있는 원본 에러는 로그에도 응답에도 남기지 않는다.
    return json({ error: 'internal error' }, 500);
  }
}

export const onRequest = ({ request }) =>
  new Response(JSON.stringify({ error: 'method not allowed' }), {
    status: 405,
    headers: { ...HEADERS, allow: 'GET' },
  });
