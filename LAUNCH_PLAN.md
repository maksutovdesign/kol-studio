# KOL Studio — план запуска: от прототипа к продукту

Прототип готов. Все экраны, все флоу, дизайн-система, PWA — есть. Теперь нужно заменить 47 заглушек на реальный код.

Ниже — полный план по шести этапам. Каждый этап завершается рабочим продуктом, который можно показать инвестору или запустить в ограниченный доступ.

---

## Карта заглушек (что именно нужно заменить)

Перед планом — понять масштаб. Аудит кода выявил:

| Категория | Файлы | Стабов | Приоритет |
|-----------|-------|--------|-----------|
| Аутентификация | auth.html | 4 | 🔴 Критично |
| Платежи | checkout.html, wallet.html | 7 | 🔴 Критично |
| База данных | search.html, wallet.html, messages.html | 5 | 🔴 Критично |
| Медиа и стриминг | live.html, upload.html | 8 | 🔴 Критично |
| Реальное время | messages.html, sw.js | 7 | 🟠 Высокий |
| Аналитика | все 14 файлов (`kolTrack`) | 1 | 🟡 Средний |
| Поиск | search.html | 3 | 🟡 Средний |
| Прочие кабинеты | model-cabinet, creator-dashboard | 4 | 🟡 Средний |

**Полный список заглушек:**
- `auth.html` — login/register только меняют страницу через setTimeout, настоящей верификации нет
- `checkout.html → handlePayment()` — анимация шагов без реального списания
- `checkout.html → triggerGPay()` — setTimeout вместо Google Pay API
- `checkout.html → applyPromo()` — хардкодный промокод `KOL20`
- `wallet.html → handleWithdraw()` — toast без вывода средств
- `wallet.html → handleTopup()` — toast без пополнения
- `messages.html → sendMessage()` — сообщения только в DOM, исчезают при перезагрузке
- `messages.html → unlockPPV()` — setTimeout вместо проверки оплаты
- `messages.html → sendMass()` — «Рассылка 847 подписчикам» в toast
- `live.html` — нет `<video>`, только логотип-заглушка
- `upload.html → publishPost()` — 1.5-секундный лоудер без загрузки файла
- `sw.js → syncLikes()` / `syncTips()` — пустые функции с console.log
- `kolTrack()` — складывает события в localStorage, никогда не отправляет
- `MODELS[]` в search.html — 12 хардкодных объектов вместо API

---

## Этап 0 — Подготовка (1–2 недели)

Это фундамент, без которого нельзя начинать разработку бэкенда.

### 0.1 Юридическое лицо и комплаенс

Взрослый контент — особая правовая зона. Без этого пункта нельзя подключить платёжную систему.

**Что сделать:**
- Зарегистрировать юридическое лицо (ИП/ООО или иностранная компания)
- Получить ОГРН/ИНН или эквивалент
- Подготовить политику конфиденциальности (GDPR + российское законодательство)
- Внедрить верификацию возраста 18+ (уже есть `age-gate.html`, нужна реальная интеграция)
- Для получения выплат от Stripe/PayPal — зарегистрировать бизнес в юрисдикции, которую они поддерживают (Кипр, Эстония, ОАЭ — распространённые варианты)
- Верификация исполнителей — документы, возраст, согласие (18 U.S.C. § 2257 уже есть страница, нужна реальная система)

**Почему это первый пункт:** Stripe заблокирует аккаунт без верификации бизнеса и соблюдения требований для adult content. PayPal не работает с такими платформами вообще. Нужен специализированный процессинг.

### 0.2 Инфраструктура и домен

**Что сделать:**
- Купить домен (`.com` или зональный)
- Подключить Cloudflare (DNS + WAF + DDoS-защита — обязательно для adult платформ)
- Выбрать облачного провайдера: **AWS** (рекомендую) или **Hetzner** (дешевле, для старта)
- Настроить окружения: `dev` / `staging` / `production`
- Настроить GitHub Actions для CI/CD

**Стек инфраструктуры:**
```
Cloudflare (DNS + CDN + WAF)
    ↓
Load Balancer (AWS ALB или Nginx)
    ↓
App Servers (Node.js / контейнеры)
    ↓
PostgreSQL (основная БД) + Redis (кэш + сессии)
    ↓
S3-совместимое хранилище (медиафайлы)
```

### 0.3 Выбор технологического стека бэкенда

Рекомендую **Node.js + PostgreSQL** — максимальная скорость разработки, хорошая экосистема для стриминга.

| Слой | Технология | Почему |
|------|-----------|--------|
| API сервер | **Node.js + Fastify** | Быстрее Express, хорошая TypeScript поддержка |
| База данных | **PostgreSQL** | Транзакции, JSON поля, row-level security |
| Кэш / сессии | **Redis** | Сессии, rate limiting, очереди |
| ORM | **Prisma** | Автогенерация типов, миграции |
| Аутентификация | **Passport.js + JWT** | Гибко, проверено |
| Хранилище файлов | **AWS S3 / Cloudflare R2** | R2 дешевле, без egress-fee |
| Email | **Resend** или **SendGrid** | Transactional email |
| Очередь задач | **BullMQ (Redis)** | Видеотранскодирование, рассылки |

---

## Этап 1 — Аутентификация и профили (3–4 недели)

**Цель этапа:** пользователь может зарегистрироваться, войти, управлять профилем. Никаких заглушек на критическом пути.

### 1.1 Система аутентификации

Заменяет заглушку в `auth.html`: вместо `setTimeout(() => location.href = 'feed.html')` — реальный API.

**API эндпоинты:**
```
POST /api/auth/register    — создание аккаунта
POST /api/auth/login       — вход, возвращает JWT + refresh token
POST /api/auth/logout      — инвалидация refresh token
POST /api/auth/refresh     — обновление access token
POST /api/auth/forgot      — запрос ссылки на сброс пароля
POST /api/auth/reset       — сброс пароля по токену
POST /api/auth/verify-email — подтверждение email
GET  /api/auth/me          — текущий пользователь
```

**Что реализовать:**
- Хеширование паролей (bcrypt, cost factor 12)
- JWT access token (15 минут) + refresh token (30 дней, httpOnly cookie)
- Email-верификация через уникальную ссылку (уже есть `verify-email.html`)
- 2FA через TOTP (Google Authenticator) — уже есть `2fa.html`
- Rate limiting на login (5 попыток / 15 минут)
- Сессии в Redis

**Схема БД (users):**
```sql
users (
  id          UUID PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  username    TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role        ENUM('fan', 'creator', 'admin'),
  verified    BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
)
```

### 1.2 Профили пользователей и авторов

Заменяет хардкод в `profile.html` и `model-cabinet.html`.

**API эндпоинты:**
```
GET  /api/users/:username      — публичный профиль
PUT  /api/users/me             — обновление профиля (сохраняет в БД, не toast)
GET  /api/creators             — список авторов с фильтрами (заменяет MODELS[])
GET  /api/creators/:id         — профиль автора
POST /api/creators/apply       — заявка на статус автора
PUT  /api/creators/me/settings — настройки автора (геоблок, tip menu, etc.)
```

**Верификация авторов:**
- Загрузка удостоверения личности (ID document)
- Проверка возраста (18+)
- Хранение в зашифрованном виде (S3 + server-side encryption)
- Статусы: `pending` → `verified` / `rejected`

### 1.3 Подписки (follow)

```
POST /api/creators/:id/subscribe    — оформить подписку
DELETE /api/creators/:id/subscribe  — отменить
GET  /api/me/subscriptions          — мои подписки
GET  /api/creators/:id/subscribers  — список подписчиков (для автора)
```

---

## Этап 2 — База данных и контент (3–4 недели)

**Цель:** заменить хардкодные массивы на реальное хранилище. После этапа `MODELS[]` и `transactions[]` уходят из кода навсегда.

### 2.1 Схема базы данных

```sql
-- Авторы
creators (
  user_id     UUID REFERENCES users(id),
  bio         TEXT,
  price       DECIMAL(10,2),  -- цена подписки
  tags        TEXT[],
  tip_menu    JSONB,           -- массив {action, price}
  goal        JSONB,           -- {label, cur, max}
  lovense     BOOLEAN,
  vr          BOOLEAN,
  geo_blocked TEXT[],          -- массив кодов стран
  tier        ENUM('free','premium','vip'),
  commission_tier ENUM('standard','silver','gold','platinum')
)

-- Контент
posts (
  id          UUID PRIMARY KEY,
  creator_id  UUID REFERENCES users(id),
  type        ENUM('photo','video','text','live','ppv'),
  caption     TEXT,
  price       DECIMAL(10,2),   -- NULL = бесплатно
  media       JSONB,           -- [{url, type, thumbnail}]
  tier_access ENUM('free','subscriber','ppv'),
  likes_count INT DEFAULT 0,
  created_at  TIMESTAMPTZ
)

-- Подписки
subscriptions (
  id          UUID PRIMARY KEY,
  fan_id      UUID REFERENCES users(id),
  creator_id  UUID REFERENCES users(id),
  plan        ENUM('monthly','quarterly','annual'),
  price       DECIMAL(10,2),
  expires_at  TIMESTAMPTZ,
  auto_renew  BOOLEAN DEFAULT true,
  status      ENUM('active','expired','cancelled')
)

-- Транзакции
transactions (
  id          UUID PRIMARY KEY,
  from_id     UUID REFERENCES users(id),
  to_id       UUID REFERENCES users(id),
  type        ENUM('subscription','tip','ppv','topup','withdrawal'),
  amount      DECIMAL(10,2),
  status      ENUM('pending','completed','failed','refunded'),
  stripe_id   TEXT,
  created_at  TIMESTAMPTZ
)

-- Чаевые
tips (
  id          UUID PRIMARY KEY,
  from_id     UUID REFERENCES users(id),
  to_id       UUID REFERENCES users(id),
  amount      DECIMAL(10,2),
  message     TEXT,
  post_id     UUID REFERENCES posts(id),
  created_at  TIMESTAMPTZ
)
```

### 2.2 API контента

```
GET  /api/feed                 — лента (пагинация cursor-based)
GET  /api/posts/:id            — пост
POST /api/posts                — создать пост (заменяет publishPost() заглушку)
PUT  /api/posts/:id            — обновить
DELETE /api/posts/:id          — удалить
POST /api/posts/:id/like       — лайк
GET  /api/creators/:id/posts   — посты автора
```

### 2.3 Поиск авторов (заменяет MODELS[])

Заменяет хардкодный массив в `search.html`. Все фильтры (`activeFilters`, `AF.cats`, ценовой слайдер) теперь идут в API:

```
GET /api/search/creators?
  q=текст
  &online=true
  &verified=true
  &tier=vip
  &tags=cosplay,asmr
  &price_max=15
  &lovense=true
  &vr=true
  &is_new=true
  &sort=popular|newest|online_new
  &page=1
  &limit=20
```

**Технология поиска:**
- На старте: PostgreSQL full-text search + индексы (достаточно для первых 10k авторов)
- При масштабировании: **Meilisearch** (self-hosted, быстрее Elasticsearch, проще в настройке)

### 2.4 Favorites

Заменяет `localStorage.getItem('kol_favorites')`:

```
POST /api/me/favorites/:creatorId   — добавить в избранное
DELETE /api/me/favorites/:creatorId — убрать
GET  /api/me/favorites              — список избранных
```

---

## Этап 3 — Платежи (4–5 недель)

**Цель:** реальное списание денег. Это самый технически сложный этап.

### 3.1 Выбор платёжного провайдера

Для adult content платформ стандартные Stripe/PayPal недоступны без специального одобрения. Варианты:

| Провайдер | Комиссия | Плюсы | Минусы |
|-----------|---------|-------|--------|
| **Stripe** (с одобрением) | 2.9% + $0.30 | Лучший API, полная экосистема | Нужен compliance review |
| **Epoch** | 10–14% | Специализируется на adult | Высокая комиссия |
| **CCBill** | 10–14% | Лидер рынка adult | Сложная интеграция, старый API |
| **Paxum** | 2–4% | Популярен среди creators | Не все страны |
| **Crypto (USDT/BTC)** | ~1% | Без ограничений | Волатильность, UX сложнее |

**Рекомендация:** Начать с CCBill или Epoch (они работают без вопросов), параллельно получить апрув Stripe.

### 3.2 Интеграция подписок

Заменяет `handlePayment()` анимацию в `checkout.html`:

```javascript
// Вместо этого:
function handlePayment() {
  advanceStep();
  setTimeout(() => { advanceStep(); ... }, 600);
}

// Будет это:
async function handlePayment() {
  const { clientSecret } = await api.post('/api/payments/subscription', {
    creatorId, planType, paymentMethodId
  });
  const result = await stripe.confirmCardPayment(clientSecret);
  if (result.error) showError(result.error.message);
  else showSuccess();
}
```

**API платежей:**
```
POST /api/payments/subscription/create  — создать подписку
POST /api/payments/subscription/cancel  — отменить
POST /api/payments/tip                  — отправить чаевые
POST /api/payments/ppv/unlock           — разблокировать PPV-контент
POST /api/payments/topup                — пополнить баланс
POST /api/payments/withdraw             — запрос на вывод
GET  /api/payments/history              — история транзакций
POST /api/payments/webhook              — вебхук от провайдера
```

### 3.3 Выплаты авторам

Заменяет `handleWithdraw()` toast в `wallet.html`:

**Схема выплат:**
1. Автор запрашивает вывод через форму
2. Создаётся запись в `withdrawals` со статусом `pending`
3. KYC-проверка (первый вывод > $500 требует верификации)
4. Автоматическая выплата через CCBill/Paxum по расписанию
5. Webhook обновляет статус → уведомление автору

**Тировая комиссия** (уже есть UI в `creator-dashboard.html`):
```javascript
function getCommission(monthlyRevenue) {
  if (monthlyRevenue >= 10000) return 0.07;  // Platinum
  if (monthlyRevenue >= 2000)  return 0.10;  // Gold
  if (monthlyRevenue >= 500)   return 0.15;  // Silver
  return 0.20;                               // Standard
}
```

### 3.4 Промокоды

Заменяет хардкод `'KOL20'` в `checkout.html → applyPromo()`:

```sql
promo_codes (
  code        TEXT UNIQUE NOT NULL,
  discount    DECIMAL(5,2),     -- 0.20 = 20%
  type        ENUM('percent','fixed'),
  max_uses    INT,
  used_count  INT DEFAULT 0,
  expires_at  TIMESTAMPTZ,
  creator_id  UUID              -- NULL = платформенный, иначе - авторский
)
```

---

## Этап 4 — Медиа и стриминг (4–6 недель)

**Цель:** реальная загрузка контента и живые трансляции.

### 4.1 Загрузка и хранение медиа

Заменяет `publishPost()` заглушку в `upload.html`.

**Архитектура:**
```
Браузер → Presigned URL → S3/R2 (прямая загрузка, без прокси через сервер)
                              ↓
                     Lambda / Worker (триггер на загрузку)
                              ↓
                     FFmpeg / AWS MediaConvert (транскодирование)
                              ↓
                     HLS файлы → CDN (Cloudflare)
```

**Форматы:**
- Фото: оригинал + WebP превью (400px, 800px, 1200px)
- Видео: транскодирование в HLS (360p, 720p, 1080p) + превью-кадр
- Видео PPV: дополнительно шифрование ключа доступа

**API:**
```
POST /api/media/presign        — получить presigned URL для прямой загрузки
POST /api/media/confirm        — подтвердить загрузку, запустить обработку
GET  /api/media/:id/status     — статус транскодирования
```

**Технологии:**
- Хранилище: **Cloudflare R2** (нет egress fee, совместим с S3 API)
- Транскодирование: **AWS MediaConvert** или **Mux** (проще, дороже)
- Видеоплеер: **Video.js + hls.js** (заменит заглушку в `live.html` и `video.html`)

### 4.2 Видеоплеер

Заменяет div-заглушку в `live.html` и `video.html`.

```html
<!-- Вместо: -->
<div id="video-area">
  <div class="video-placeholder"><!-- Логотип --></div>
</div>

<!-- Будет: -->
<video id="player" class="video-js vjs-default-skin">
  <source src="https://cdn.kolstudio.com/streams/anna-m/playlist.m3u8" 
          type="application/x-mpegURL">
</video>
```

```javascript
const player = videojs('player', {
  autoplay: false,
  controls: true,
  responsive: true,
  fluid: true,
  html5: { hls: { overrideNative: true } }
});
```

### 4.3 Live стриминг

Заменяет `startLive()` toast в `model-cabinet.html`.

**Архитектура:**
```
OBS / мобильное приложение
    ↓ RTMP
Медиасервер (Mediamtx или AWS IVS)
    ↓ транскодирование в реальном времени
HLS сегменты (2-6 секунд latency)
    ↓
Cloudflare CDN
    ↓
Зрители (live.html с Video.js)
```

**Рекомендуемые провайдеры:**
- **AWS IVS** (Interactive Video Service) — самый простой старт, $0.20/час + $0.0085/Гб
- **Mux** — лучший developer experience, чуть дороже
- **Mediamtx** (self-hosted) — бесплатно, но нужен сервер с хорошим апстримом

**Stream ключи для авторов:**
```sql
stream_keys (
  creator_id  UUID REFERENCES users(id),
  key         TEXT UNIQUE,     -- генерируется автоматически
  is_live     BOOLEAN DEFAULT false,
  started_at  TIMESTAMPTZ,
  viewers     INT DEFAULT 0
)
```

### 4.4 DRM для PPV-контента

Чтобы PPV-видео нельзя было скачать обычными инструментами:

- **Простой вариант:** подписанные URL с коротким TTL (1 час) — достаточно для старта
- **Продвинутый:** Widevine/FairPlay DRM через Mux или AWS MediaConvert + CloudFront Signed Cookies

---

## Этап 5 — Реальное время (3–4 недели)

**Цель:** сообщения, уведомления и live-чат работают без перезагрузки страницы.

### 5.1 WebSocket сервер

Заменяет `sendMessage()` DOM-заглушку в `messages.html`.

**Технология:** **Socket.io** (над Node.js) — проще в настройке, автоматический fallback на long polling.

**События:**
```javascript
// Клиент → Сервер
socket.emit('message:send', { toId, text, attachments })
socket.emit('tip:send', { toId, amount, message })
socket.emit('live:join', { streamId })
socket.emit('live:tip', { streamId, amount })
socket.emit('live:leave', { streamId })

// Сервер → Клиент
socket.on('message:received', (message) => { /* добавить в DOM */ })
socket.on('tip:received', (tip) => { /* kolFireTip() */ })
socket.on('notification', (notif) => { /* показать бейдж */ })
socket.on('live:viewer_count', (count) => { /* обновить счётчик */ })
socket.on('goal:updated', (goal) => { /* обновить прогресс-бар */ })
```

### 5.2 Чат сообщений

Заменяет DOM-хранилище в `messages.html`.

```sql
conversations (
  id          UUID PRIMARY KEY,
  creator_id  UUID REFERENCES users(id),
  fan_id      UUID REFERENCES users(id),
  last_msg_at TIMESTAMPTZ,
  unread_fan  INT DEFAULT 0,
  unread_creator INT DEFAULT 0
)

messages (
  id              UUID PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id),
  sender_id       UUID REFERENCES users(id),
  type            ENUM('text','tip','ppv','voice','image'),
  content         TEXT,
  price           DECIMAL(10,2),   -- для PPV-сообщений
  media_url       TEXT,
  is_unlocked     BOOLEAN,
  created_at      TIMESTAMPTZ
)
```

**API:**
```
GET  /api/conversations               — список диалогов
GET  /api/conversations/:id/messages  — история сообщений (пагинация)
POST /api/conversations/:id/messages  — отправить сообщение
POST /api/messages/:id/unlock         — разблокировать PPV-сообщение
POST /api/messages/mass               — рассылка (фоновая задача через BullMQ)
```

### 5.3 Push-уведомления

Заменяет заглушку в `sw.js` (Service Worker):

```javascript
// Сейчас в sw.js:
async function syncLikes() {
  console.log('[SW] Синхронизация лайков...'); // пусто
}

// После:
async function syncLikes() {
  const db = await openDB('kol-offline', 1);
  const pendingLikes = await db.getAll('pending_likes');
  if (pendingLikes.length === 0) return;
  await fetch('/api/likes/batch', {
    method: 'POST',
    body: JSON.stringify(pendingLikes),
    headers: { 'Authorization': `Bearer ${await getToken()}` }
  });
  await db.clear('pending_likes');
}
```

**Push через FCM:**
```javascript
// Сервер отправляет уведомление:
await admin.messaging().send({
  token: user.fcm_token,
  notification: { title: 'Новое сообщение', body: 'Анна М. написала вам' },
  webpush: { fcmOptions: { link: '/messages' } }
});
```

### 5.4 Авто-Респондер (бот)

Заменяет toast-заглушки в `model-cabinet.html` (секция «🤖 Автоответы»):

```javascript
// BullMQ worker для авто-ответов:
autoresponderWorker.process(async (job) => {
  const { trigger, userId, creatorId, meta } = job.data;
  const rules = await db.creator_bot_rules.findMany({
    where: { creator_id: creatorId, trigger, enabled: true }
  });
  for (const rule of rules) {
    const text = rule.template
      .replace('{имя}', meta.userName)
      .replace('{сумма}', meta.amount)
      .replace('{план}', meta.plan);
    await sendMessage(creatorId, userId, text, rule.delay_seconds);
  }
});
```

---

## Этап 6 — Аналитика и поиск (2–3 недели)

**Цель:** `kolTrack()` отправляет реальные данные, автор видит реальную статистику.

### 6.1 Аналитика

Заменяет `kolTrack()` заглушку (localStorage → никуда).

**Вариант 1 — Готовое решение (быстрее):**
- **PostHog** (self-hosted или облако, open source)
- Замена: `kolTrack(event, props)` → `posthog.capture(event, props)`
- Готовые дашборды, funnel analysis, retention, session recording

**Вариант 2 — Своя аналитика:**
```javascript
// Новая реализация kolTrack():
window.kolTrack = async function(event, props) {
  const batch = JSON.parse(localStorage.getItem('kol_analytics_queue') || '[]');
  batch.push({ event, props, ts: Date.now(), userId: getCurrentUserId() });
  
  if (batch.length >= 10 || event === 'subscription_started') {
    await fetch('/api/analytics/batch', {
      method: 'POST',
      body: JSON.stringify(batch),
      keepalive: true  // отправляется даже при закрытии вкладки
    });
    localStorage.removeItem('kol_analytics_queue');
  } else {
    localStorage.setItem('kol_analytics_queue', JSON.stringify(batch));
  }
};
```

**Ключевые метрики для `creator-dashboard.html`:**
```
GET /api/analytics/creator/overview    — доход, подписчики, просмотры за период
GET /api/analytics/creator/revenue     — доход по дням/неделям
GET /api/analytics/creator/content     — топ посты по доходу
GET /api/analytics/creator/retention   — удержание подписчиков
GET /api/analytics/creator/funnel      — просмотры → подписка
```

### 6.2 Feature Flags

Заменяет `KOL_FLAGS` из localStorage:

```javascript
// Сейчас — из localStorage:
window.KOL_FLAGS = (function() {
  return { showFAB: true, newFeedAlgo: false, ... };
})();

// После — из API (кэшируется на 5 минут):
const flags = await fetch('/api/flags?userId=' + userId)
  .then(r => r.json());
window.KOL_FLAGS = flags;
```

**Либо подключить LaunchDarkly / GrowthBook** — это 1 день работы и даёт A/B тесты, процентный роллаут, per-user флаги.

---

## Этап 7 — Модерация и безопасность (2–3 недели, параллельно)

Это не опциональный пункт. Без него платформа не сможет легально работать.

### 7.1 Верификация возраста исполнителей

Уже есть `creator-apply.html` с формой. Нужен бэкенд:

- Загрузка паспорта/ID через presigned URL (S3 + encryption)
- Ручная проверка модератором (внутренняя панель)
- Или автоматическая через **Stripe Identity** / **Jumio** / **Onfido**
- Хранение подтверждений (18 U.S.C. § 2257 требует хранить 7 лет)

### 7.2 Сканирование контента

Обязательно для любой платформы с пользовательским контентом:

- **CSAM** (child sexual abuse material): интеграция с **PhotoDNA** (Microsoft) или **NCMEC Hash Matching** — работает при загрузке каждого файла
- **Nudity detection**: AWS Rekognition или **Clarifai** — для автоматической модерации (помечает спорный контент для ручной проверки)
- **Watermarking**: незаметные водяные знаки на PPV-контенте для отслеживания утечек

### 7.3 DMCA система

Уже есть `dmca.html` — нужна обработка:

```
POST /api/dmca/report          — подать жалобу
GET  /api/dmca/reports         — список жалоб (для модераторов)
POST /api/dmca/:id/takedown    — снять контент
POST /api/dmca/:id/counter     — контрзаявление
```

### 7.4 Rate Limiting и безопасность API

- Rate limiting через Redis: 100 req/мин для анонимов, 1000 для авторизованных
- CORS с whitelist доменов
- Helmet.js (security headers)
- Валидация всех входящих данных (Zod/Joi)
- SQL injection защита (Prisma ORM)
- File upload: проверка MIME type, max size, вирус-скан

---

## Итоговый roadmap

```
Месяц 1         Месяц 2         Месяц 3         Месяц 4         Месяц 5–6
│               │               │               │               │
Этап 0          Этап 1          Этап 2          Этап 3          Этапы 4–7
Подготовка      Авторизация     База данных     Платежи         Медиа, Стриминг
Юрлицо          Профили         Контент API     Подписки        Реальное время
Инфраструктура  Верификация     Поиск API       Выплаты         Аналитика
                                                                Модерация
│               │               │               │               │
                Закрытое        Открытое        Монетизация     Полный запуск
                тестирование    бета            работает
```

### Приоритет минимального запуска (MVP)

Если нужно запустить быстро и проверить спрос — минимальный набор:

1. ✅ Аутентификация (Этап 1.1)
2. ✅ Профили авторов (Этап 1.2)
3. ✅ Загрузка фото (Этап 4.1, только фото, без видео)
4. ✅ Один платёжный провайдер (CCBill или Stripe, Этап 3)
5. ✅ Подписки и доступ к контенту (Этап 2.2 + 3.2)
6. ✅ Верификация возраста (Этап 7.1)

Это 2–3 месяца работы одного fullstack-разработчика или 1 месяц команды из трёх человек.

---

## Команда и бюджет

### Минимальная команда для запуска:
| Роль | Задачи |
|------|--------|
| **Backend developer** (senior) | API, БД, платежи, авторизация |
| **DevOps / Infra** | AWS/Cloudflare, CI/CD, мониторинг |
| **Frontend developer** | Интеграция API в существующий HTML/JS (замена заглушек) |
| **Модератор / Support** | Верификация авторов, DMCA, поддержка |

### Ежемесячные расходы на инфраструктуру (старт):
| Статья | Сумма/мес |
|--------|-----------|
| AWS / Hetzner (серверы) | $100–300 |
| Cloudflare R2 (хранилище 1TB) | $15 |
| Cloudflare (CDN + DDoS) | $20 |
| AWS IVS / Mux (стриминг) | $200–500 |
| PostgreSQL (managed, RDS) | $50–100 |
| Redis (Upstash) | $10–30 |
| Email (Resend) | $20 |
| Мониторинг (Sentry) | $26 |
| **Итого** | **~$440–1000/мес** |

---

*Весь frontend уже готов. Задача — написать бэкенд, который будет за ним стоять.*
