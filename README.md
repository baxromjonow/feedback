# Al-Aziz Academy Feedback Bot — v0.2

## Yangi funksiyalar
- Yangi anonimlik matni
- Admin panel
- Statuslar: Yangi / Ko‘rib chiqilmoqda / Jarayonda / Hal qilindi
- Admin → foydalanuvchi anonim javob
- Foydalanuvchi → admin javob
- `Mening murojaatlarim` ichida ticket ochish
- Superadmin identity reveal + audit log
- Admin uchun shaxsiy ma’lumotlarsiz `admin_ticket_view`
- Foydalanuvchi matnlarini HTML escape qilish
- Callback spinnerini darhol yopish

## v0.1 dan v0.2 ga yangilash

### 1. Supabase migration
Supabase → SQL Editor → `supabase/v0.2.sql` faylini to‘liq qo‘ying va Run bosing.

### 2. Vercel ENV
Eski ENV qiymatlar qoladi.

Qo‘shimcha, oddiy adminlar bo‘lsa:
```env
ADMIN_IDS=111111111,222222222
```

`SUPERADMIN_IDS` ichidagi ID avtomatik admin hisoblanadi.
Agar hozir faqat superadmin bo‘lsa, `ADMIN_IDS` bo‘sh qolishi mumkin.

### 3. Tekshirish
```bash
npm install
npm run typecheck
```

### 4. GitHubga push
```bash
git add .
git commit -m "Feedback bot v0.2"
git push
```

Vercel GitHub pushdan keyin redeploy qiladi.

### 5. Test
Oddiy oqim:
```text
/start student
```

Admin panel:
```text
/admin
```

## Xavfsizlik
`.env.local`, bot token va `sb_secret_...` kalitni GitHubga yubormang.
