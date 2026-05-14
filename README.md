# Pirogram v21 GitHub-ready

В этой сборке:

- исправлена загрузка свежих TURN-настроек перед каждым звонком;
- добавлена кнопка «Включить звук», если браузер заблокировал audio autoplay;
- ICE-кандидаты отправляются пачкой, чтобы звонки стабильнее соединялись через разные сети;
- улучшены плавные анимации сообщений: удержание открывает меню действий с мягкой подсветкой, свайп влево показывает стрелку «Ответ» и плавно возвращает пузырь;
- обновлён service worker cache до `pirogram-shell-v21`, чтобы PWA не держала старый код.

После загрузки в GitHub Vercel сам начнёт новый деплой. После статуса Ready открой сайт заново или переустанови PWA, если старое приложение залипло.

---

# Pirogram v5

Готовый стартовый проект мессенджера под Vercel: тёмно‑золотой дизайн, вход по логину/паролю, регистрация, поиск людей по `@username`, личные чаты, фото/видео в сообщениях, PWA, push-уведомления и галочки прочтения сообщений.

## Что изменено в v5

- Убрана рекламная/начальная страница. `/` теперь сразу показывает страницу входа и регистрации.
- После входа пользователь сразу попадает в `/chat`.
- Дизайн переделан в тёмно‑жёлтые/золотые тона.
- Добавлены галочки сообщений:
  - `✓` — сообщение отправлено на сервер;
  - `✓✓` — другой пользователь открыл чат и сообщение считается прочитанным.
- Добавлен `lastReadAt` в `ChatMember`, поэтому после деплоя Prisma применит новую миграцию.
- Улучшена мобильная форма входа/регистрации: `credentials: include`, понятные ошибки, показ пароля, логин или `@username` для входа.
- Push больше не считается ошибкой сайта: он включается после добавления VAPID ключей в Vercel.

## Установка на Vercel

Загружай в GitHub все файлы и папки проекта, не только `index.html`.

В Vercel должны быть переменные:

```env
DATABASE_URL="твоя ссылка Neon/Postgres"
JWT_SECRET="pirogram_super_secret_key_2026_very_long_random_string_123456789"
NEXT_PUBLIC_APP_URL="https://pirogram.vercel.app"
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_SUBJECT="mailto:admin@example.com"
```

`DATABASE_URL` у тебя уже создаёт Neon/Vercel.

## Push-уведомления

Если в чате написано, что надо добавить VAPID ключи, это значит: сайт работает, но сервер ещё не имеет ключей для отправки push-уведомлений.

Создать свои ключи можно командой:

```bash
npm install
npm run push:keys
```

После этого добавь в Vercel → Project → Environment Variables:

```env
VAPID_PUBLIC_KEY="полученный public key"
VAPID_PRIVATE_KEY="полученный private key"
VAPID_SUBJECT="mailto:admin@example.com"
```

После добавления переменных нажми Redeploy без кэша. Затем зайди на сайт с телефона и нажми кнопку уведомлений в чате.

Важно: `VAPID_PRIVATE_KEY` нельзя выкладывать в публичный GitHub. Храни его только в Vercel Environment Variables.

## Локальный запуск

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

## Деплой

Команда сборки уже настроена:

```bash
prisma generate && prisma migrate deploy && next build
```

## Проверка после деплоя

1. Открой сайт.
2. Зарегистрируй аккаунт.
3. Открой сайт во второй вкладке/на телефоне и создай второй аккаунт.
4. Найди второго пользователя по `@username`.
5. Отправь сообщение.
6. Когда второй пользователь откроет чат, у первого сообщения появятся две галочки.


## Шифрование сообщений в базе

Сообщения, медиа и имена файлов шифруются на сервере перед записью в PostgreSQL/Neon через AES-256-GCM. Это шифрование данных в базе, не end-to-end: сервер Vercel расшифровывает данные для участников чата при чтении.

1. Сгенерируй ключ:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

2. Добавь результат в Vercel → Project → Settings → Environment Variables:

```env
MESSAGE_ENCRYPTION_KEY="вставь_сгенерированный_ключ"
```

3. После деплоя новые сообщения будут храниться зашифрованными. Чтобы зашифровать старые сообщения, запусти один раз локально или через защищенный job с доступом к DATABASE_URL:

```bash
npm run prisma:generate
npm run db:encrypt-existing
```

## Регион Vercel

Регион Vercel больше не зафиксирован в `vercel.json`: принудительный Stockholm `arn1` убран, чтобы не было лишней задержки. Vercel снова использует регион проекта/дефолтную настройку. Если в Dashboard вручную выставлен `arn1`, уберите его там тоже.

## v18 changes

- Added required PWA install gate: users see Android/iPhone install instructions and the app UI opens only in standalone web-app mode.
- Added group chats: create a common chat, rename it, invite users by `@username`, and leave the chat.
- Added message replies: swipe a message left or long-press it and tap Reply.
- Added message deletion: long-press a message to delete it only for yourself, or delete your own message for everyone.
- Added polling for chat list changes, so new chats and chat deletions appear without manually reopening the app.
- Added smoother chat row, bubble, modal, and PWA gate animations.

After deploying this version run the database migration on Vercel/Neon:

```bash
npx prisma migrate deploy
```

## v19 reactions and motion

- Added animated swipe-to-reply feedback on messages.
- Added centered minimal message actions menu.
- Added reactions with only two allowed emojis: 😘 and ❤️‍🔥.
- Added quick reaction setting for double tap.
- Added Prisma migration `20260512073000_message_reactions` for message reactions.

## v20 admin, maintenance, group profiles, avatars, calls

- `@admin` gets a private admin panel in Settings.
- Admin can turn on maintenance mode. While it is on, everyone else sees `Закрыто на тех обслуживание`, and only `@admin` can keep using the app.
- Admin can search users and change their public `@username` / display name.
- Admin can add/remove extra free usernames for himself. These aliases are searchable and can be used to start chats.
- Group creation and adding members now support searching by regular display name or `@username` and tapping a profile.
- Group header opens a Telegram-like group info sheet with avatar, members, and actions: call, rename, add user, change avatar, leave.
- Profile and group avatars can be changed with a circular crop preview.
- Calls now load ICE config from `/api/calls/ice`. STUN works by default; for stable calls across different Wi-Fi/NAT/mobile networks add TURN variables in Vercel:

```env
TURN_URLS="turn:your-turn.example.com:3478,turns:your-turn.example.com:5349"
TURN_USERNAME="your_turn_username"
TURN_CREDENTIAL="your_turn_password"
```

Without TURN, WebRTC may still fail on strict routers or mobile networks even if the app code is correct.
