// Habio Service Worker
// バージョンを上げると古いキャッシュが自動削除されます
const CACHE_VERSION = 'habio-v2';
const SHELL_CACHE   = `${CACHE_VERSION}-shell`;
const FONT_CACHE    = `${CACHE_VERSION}-fonts`;

// APIエンドポイント — キャッシュしない
const BYPASS_HOSTS = [
  'habio-chat.katsuyuki-jyoukou.workers.dev',
  'habio-stripe.katsuyuki-jyoukou.workers.dev',
  'api.openai.com',
  'api.twitter.com',
  'x.com',
  'twitter.com',
  'app.rakuten.co.jp',
  'api.open-meteo.com',
  'a.r10.to',
];

// ── Install: 即時アクティベート ────────────────────────
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ── Activate: 古いキャッシュを削除 ────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && k !== FONT_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // APIホストはすべてネットワーク直接
  if (BYPASS_HOSTS.some(h => url.hostname.includes(h))) {
    event.respondWith(fetch(req));
    return;
  }

  // Google Fonts — stale-while-revalidate
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(req, FONT_CACHE));
    return;
  }

  // 同一オリジンのリクエストはすべて NetworkFirst
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req, SHELL_CACHE));
    return;
  }

  // その他のクロスオリジン — そのまま fetch
  event.respondWith(
    fetch(req).catch(() => new Response('', { status: 503 }))
  );
});

// NetworkFirst: ネットワーク優先、失敗時にキャッシュへフォールバック
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok || response.status === 0) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // ナビゲーションリクエストはapp.htmlのキャッシュにフォールバック
    if (request.mode === 'navigate') {
      const appCache = await caches.match('/app') || await caches.match('/app.html');
      if (appCache) return appCache;
    }
    return new Response(
      '<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>🌿 オフラインです</h2><p>インターネット接続を確認してください。</p></body></html>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

// StaleWhileRevalidate: キャッシュを即返しつつバックグラウンドで更新
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then(res => { if (res.ok) cache.put(request, res.clone()); return res; })
    .catch(() => null);
  return cached || await fetchPromise || new Response('', { status: 503 });
}

// ── Message ────────────────────────────────────────────
self.addEventListener('message', event => {
  // ページからのキャッシュ全削除指示
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys()
        .then(keys => Promise.all(keys.map(k => caches.delete(k))))
        .then(() => {
          if (event.source) event.source.postMessage({ type: 'CACHE_CLEARED' });
        })
    );
  }
  // 新しいSWを即時有効化
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Push 通知受信 ──────────────────────────────────────────────
self.addEventListener('push', event => {
  console.log('[SW push] event received, hasData=' + !!event.data);
  if (!event.data) {
    console.warn('[SW push] no data, skipping');
    return;
  }

  let data;
  try {
    data = event.data.json();
    console.log('[SW push] payload:', JSON.stringify(data));
  } catch (e) {
    console.error('[SW push] JSON parse failed:', e.message, '| raw:', event.data.text());
    return;
  }

  const title = data.title || 'Habio 🌿';
  const body  = data.body  || 'Habio からのお知らせ';
  console.log('[SW push] showNotification title="' + title + '" body="' + body + '"');

  const options = {
    body,
    icon:             data.icon   || '/icons/icon-192.svg',
    badge:            data.badge  || '/icons/icon-192.svg',
    tag:              data.tag    || 'habio',
    data:             data.data   || { url: '/app' },
    vibrate:          [120, 60, 120],
    requireInteraction: false,
    silent:           false,
  };
  console.log('[SW push] options:', JSON.stringify(options));

  event.waitUntil((async () => {
    try {
      await self.registration.showNotification(title, options);
      console.log('[SW push] showNotification OK');
    } catch (e) {
      console.error('[SW push] showNotification FAILED:', e.message);
    }
    // アプリアイコンにバッジを表示
    try {
      const shown = await self.registration.getNotifications();
      console.log('[SW push] visible notifications count:', shown.length);
      if (self.navigator?.setAppBadge) await self.navigator.setAppBadge(shown.length);
    } catch (_) {}
  })());
});

// ── 通知タップ → アプリを開く ──────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  // バッジをクリア
  try { if (self.navigator?.clearAppBadge) self.navigator.clearAppBadge(); } catch (_) {}

  const notifData = event.notification.data || {};
  const targetUrl = notifData.url || '/app';
  const targetTab = notifData.tab || null;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => new URL(c.url).pathname.startsWith('/app'));
      if (existing) {
        existing.focus();
        if (targetTab) existing.postMessage({ type: 'NAVIGATE_TAB', tab: targetTab });
        return;
      }
      return clients.openWindow(targetUrl);
    })
  );
});

// ── Subscription 変更時（ブラウザによる自動更新） ────────────
self.addEventListener('pushsubscriptionchange', event => {
  // TODO: Re-subscribe and update push-worker
  console.log('[SW] pushsubscriptionchange');
});
