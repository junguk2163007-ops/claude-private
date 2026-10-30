// 서비스워커 — 앱 전체를 캐시해 오프라인에서도 동작
// 파일을 고치면 VERSION을 올린다 (예: v1.0.1). 버전이 바뀌면 새 캐시를 받고 옛 캐시는 지운다.
const VERSION = 'v1.0.0';
const CACHE = `elec-guide-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './flow.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
];

self.addEventListener('install', (e) => {
  // HTTP 캐시를 거치지 않고 최신 파일을 받는다
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('elec-guide-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// 앱 화면의 "적용" 버튼에서 보냄
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});

// 캐시 우선 — 신호가 약해도 바로 열린다
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE).then((c) =>
        c.match('./index.html').then((hit) => hit || fetch(req))
      ).catch(() => fetch(req))
    );
    return;
  }
  e.respondWith(
    caches.open(CACHE).then((c) =>
      c.match(req, { ignoreSearch: true }).then((hit) => hit || fetch(req))
    )
  );
});
