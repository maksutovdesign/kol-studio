/**
 * KOL Studio — Service Worker
 * Версия кэша обновляется при каждом деплое
 */

const CACHE_NAME = 'kol-studio-v8';
const RUNTIME_CACHE = 'kol-runtime-v8';

// Файлы для предварительного кэширования (App Shell) — все 62 страницы
const PRECACHE_URLS = [
  '/splash.html',
  '/age-gate.html',
  '/onboarding.html',
  '/index.html',
  '/landing.html',
  '/feed.html',
  '/search.html',
  '/profile.html',
  '/post.html',
  '/stories.html',
  '/collection.html',
  '/live.html',
  '/session.html',
  '/auth.html',
  '/creator-apply.html',
  '/checkout.html',
  '/upload.html',
  '/schedule.html',
  '/messages.html',
  '/notifications.html',
  '/wallet.html',
  '/analytics.html',
  '/promo.html',
  '/referral.html',
  '/leaderboard.html',
  '/model-cabinet.html',
  '/user-cabinet.html',
  '/help.html',
  '/terms.html',
  '/privacy.html',
  '/cookie.html',
  '/dmca.html',
  '/2257.html',
  '/forgot-password.html',
  '/verify-email.html',
  '/bookmarks.html',
  '/video.html',
  '/pricing.html',
  '/gift.html',
  '/ppv-unlock.html',
  '/custom-request.html',
  '/2fa.html',
  '/account-security.html',
  '/subscription-manage.html',
  '/tip-history.html',
  '/creator-landing.html',
  '/blog.html',
  '/blog-post.html',
  '/500.html',
  '/maintenance.html',
  '/status.html',
  '/payouts.html',
  '/sitemap.html',
  '/report.html',
  '/api-docs.html',
  '/creator-dashboard.html',
  '/offline.html',
  '/fan-club.html',
  '/affiliate.html',
  '/press.html',
  '/notifications-settings.html',
  '/404.html',
  // en/ locale pages
  '/en/2257.html',
  '/en/2fa.html',
  '/en/404.html',
  '/en/500.html',
  '/en/account-security.html',
  '/en/affiliate.html',
  '/en/age-gate.html',
  '/en/analytics.html',
  '/en/api-docs.html',
  '/en/auth.html',
  '/en/blog-post.html',
  '/en/blog.html',
  '/en/bookmarks.html',
  '/en/checkout.html',
  '/en/collection.html',
  '/en/cookie.html',
  '/en/creator-apply.html',
  '/en/creator-dashboard.html',
  '/en/creator-landing.html',
  '/en/custom-request.html',
  '/en/dmca.html',
  '/en/fan-club.html',
  '/en/feed.html',
  '/en/forgot-password.html',
  '/en/gift.html',
  '/en/help.html',
  '/en/index.html',
  '/en/landing.html',
  '/en/leaderboard.html',
  '/en/live.html',
  '/en/maintenance.html',
  '/en/messages.html',
  '/en/model-cabinet.html',
  '/en/notifications-settings.html',
  '/en/notifications.html',
  '/en/offline.html',
  '/en/onboarding.html',
  '/en/payouts.html',
  '/en/post.html',
  '/en/ppv-unlock.html',
  '/en/press.html',
  '/en/pricing.html',
  '/en/privacy.html',
  '/en/profile.html',
  '/en/promo.html',
  '/en/referral.html',
  '/en/report.html',
  '/en/schedule.html',
  '/en/search.html',
  '/en/session.html',
  '/en/sitemap.html',
  '/en/splash.html',
  '/en/status.html',
  '/en/stories.html',
  '/en/subscription-manage.html',
  '/en/terms.html',
  '/en/tip-history.html',
  '/en/upload.html',
  '/en/user-cabinet.html',
  '/en/verify-email.html',
  '/en/video.html',
  '/en/wallet.html',
  '/manifest.json',
  '/sw.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap'
];

// ─── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Предварительное кэширование app shell');
        // Кэшируем по одному, чтобы ошибка одного файла не ломала всё
        return Promise.allSettled(
          PRECACHE_URLS.map(url =>
            cache.add(url).catch(err => console.warn(`[SW] Не удалось кэшировать: ${url}`, err))
          )
        );
      })
      .then(() => self.skipWaiting())
  );
});

// ─── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map(name => {
            console.log('[SW] Удаляем старый кэш:', name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});

// ─── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Пропускаем не-GET запросы
  if (request.method !== 'GET') return;

  // Пропускаем запросы к другим доменам (кроме Google Fonts)
  const isGoogleFonts = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');
  if (url.origin !== self.location.origin && !isGoogleFonts) return;

  // Стратегия: Cache First для статики, Network First для HTML
  if (request.destination === 'document' || request.url.endsWith('.html')) {
    // Network First для HTML страниц
    event.respondWith(networkFirst(request));
  } else if (isGoogleFonts || request.destination === 'style' || request.destination === 'script' || request.destination === 'image') {
    // Cache First для ресурсов
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

// Cache First: отдаём из кэша, если есть; иначе сеть → кэш
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    return new Response('Нет соединения', { status: 503, statusText: 'Offline' });
  }
}

// Network First: сначала сеть → кэш на случай оффлайна
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Fallback на 404 страницу для HTML запросов
    if (request.destination === 'document') {
      return caches.match('/404.html');
    }
    return new Response('Нет соединения', { status: 503 });
  }
}

// ─── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Новое уведомление от KOL Studio',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-72.png',
    vibrate: [100, 50, 100],
    data: { url: data.url || '/feed.html' },
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'close', title: 'Закрыть' }
    ],
    tag: data.tag || 'kol-notification',
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'KOL Studio', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'close') return;

  const url = event.notification.data?.url || '/feed.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ─── Background Sync ───────────────────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-likes') {
    event.waitUntil(syncLikes());
  }
  if (event.tag === 'sync-tips') {
    event.waitUntil(syncTips());
  }
});

async function syncLikes() {
  console.log('[SW] Синхронизация лайков...');
  // В реальном приложении: берём из IndexedDB и отправляем на сервер
}

async function syncTips() {
  console.log('[SW] Синхронизация чаевых...');
}

console.log('[SW] KOL Studio Service Worker loaded v8');
