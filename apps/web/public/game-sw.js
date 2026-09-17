// Network-only: never cache game saves, authoring APIs, or stale release assets.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));
self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => new Response('<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>인터넷 연결 필요</title><body style="background:#211c15;color:#ead8b2;font:18px/1.7 sans-serif;padding:32px"><h1>인터넷 연결을 확인해 주세요</h1><p>게임을 시작하려면 인터넷 연결이 필요합니다.</p><button onclick="location.reload()">다시 불러오기</button></body></html>', { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
