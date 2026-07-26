# Al-Aziz Academy Feedback Bot — v0.2.1

## Tuzatilganlar

- `/admin` yanada toza ADMIN PANEL oynasini ochadi.
- Admin anonim javob yuborgach, endi adashib bo‘sh ro‘yxatga tushmaydi.
- Javobdan so‘ng:
  - `📂 Murojaatga qaytish`
  - `🛠 Admin panel`
  tugmalari chiqadi.
- Foydalanuvchi javobidan keyin ticketga qaytish osonlashtirildi.
- Muallif ma’lumoti oynasi nafislashtirildi.
- Birinchi murojaat matni `Yozishmalar` ichida qayta takrorlanmaydi.
- Supabase uchun yangi migration kerak emas.

## Yangilash

v0.2 ustiga shu loyihadagi fayllarni almashtiring.

So‘ng:

```bash
npm run typecheck
git add .
git commit -m "Feedback bot v0.2.1"
git push
```

Vercel avtomatik deploy qiladi.

## Test

Superadmin:

```text
/admin
```

Keyin ticket oching → `💬 Anonim javob` → xabar yozing.

Kutilgan natija:

```text
✅ Javob yuborildi!

#A001002 murojaat egasiga
anonim tarzda yetkazildi.

📂 Murojaatga qaytish
🛠 Admin panel
```
