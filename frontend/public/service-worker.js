const appPages = new Set(["/", "/demo/"]);

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.mode !== "navigate" || url.origin !== self.location.origin || !appPages.has(url.pathname)) return;

  // Always use the network so site access checks and the latest forecasts apply.
  event.respondWith(fetch(request).catch(() => new Response(
    `<!doctype html><html lang="ko"><meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>물가레이더 연결 안내</title>
    <body style="font: 1rem system-ui; color: #12362d; padding: 2rem">
    <h1>인터넷 연결이 필요합니다</h1>
    <p>연결을 확인한 뒤 물가레이더를 다시 열어 주세요.</p>
    <p><a href="/demo/">다시 열기</a></p></body></html>`,
    { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } }
  )));
});
