# Al-Aziz Academy — Talab / Taklif / Shikoyat bot

Starter v0.1:
- Telegram webhook
- Student / Employee deep-link
- Smooth inline callbacks
- Supabase PostgreSQL
- Text ticket yaratish
- "Mening murojaatlarim"
- Superadmin notification
- Webhook secret verification
- Vercel `waitUntil()` for non-critical work

## 1. Supabase

Yangi Supabase project yarating.

`supabase/schema.sql` faylini:
**Supabase → SQL Editor → New query**
ichiga to‘liq qo‘yib **Run** bosing.

## 2. Local env

`.env.example` dan `.env.local` yarating:

```env
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPERADMIN_IDS=...
WEBHOOK_URL=https://YOUR-VERCEL-DOMAIN.vercel.app/api/telegram
```

`SUPABASE_SERVICE_ROLE_KEY` faqat serverda turishi kerak.
GitHubga `.env.local` yubormang.

## 3. Install

```bash
npm install
npm run typecheck
```

Local:
```bash
npm run dev
```

Telegram webhook uchun public HTTPS URL kerak, shuning uchun asosiy testni Vercel deploydan keyin qilamiz.

## 4. GitHub + Vercel

```bash
git init
git add .
git commit -m "Initial feedback bot"
git branch -M main
git remote add origin YOUR_GITHUB_REPO
git push -u origin main
```

Vercel projectni GitHub repoga ulang.

Vercel → Settings → Environment Variables:
- TELEGRAM_BOT_TOKEN
- TELEGRAM_WEBHOOK_SECRET
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPERADMIN_IDS

Node.js runtime sifatida Node 22 yoki undan yangi LTS ishlating.

## 5. Webhook o‘rnatish

Deploydan keyin `.env.local` ichida:

```env
WEBHOOK_URL=https://YOUR-DOMAIN.vercel.app/api/telegram
```

so‘ng:

```bash
npm run set-webhook
```

## 6. QR deep-link

O‘quvchi QR:
```text
https://t.me/YOUR_BOT_USERNAME?start=student
```

Xodim QR:
```text
https://t.me/YOUR_BOT_USERNAME?start=employee
```

QR ni keyin shu ikkita linkdan chizamiz.

## Smooth arxitektura

- `/start` javobi Telegram webhook HTTP response orqali bevosita ketadi.
- Inline callback spinneri darhol `answerCallbackQuery` bilan yopiladi.
- DB/log/admin notification kabi ikkilamchi ishlar `waitUntil()`ga beriladi.
- Ticket yaratish DB ichidagi RPC orqali bitta round-tripda bajariladi.
- Telegram API fetchlariga timeout qo‘yilgan.
- SQL indexlar status, type, telegram_id va created_at bo‘yicha qo‘yilgan.

## Keyingi versiya

v0.2:
- rasm / video / voice / document
- admin panel
- superadmin identity reveal + audit log
- ticket ichida anonim yozishma
- status o‘zgartirish
- baholash
- rate limit
