# Al-Aziz Academy Feedback Bot — v0.3.0

## Yangi: Superadmin Audit tarixi

- Admin panelda faqat superadminlarga `📜 Audit tarixi` tugmasi ko‘rinadi.
- Oxirgi 15 ta muallif ma’lumotini ochish hodisasi ko‘rsatiladi.
- Har bir auditda: ticket raqami, sabab, Toshkent vaqti, superadmin ismi/username/Telegram ID ko‘rinadi.
- Audit yozuvidan murojaatning o‘ziga o‘tish mumkin.
- Oddiy admin audit bo‘limiga kira olmaydi.
- Mavjud `identity_logs` jadvalidan foydalanadi — yangi SQL migration shart emas.

## Yangilash

```bash
npm install
npm run typecheck
git add .
git commit -m "Feedback bot v0.3 audit history"
git push
```

Vercel pushdan keyin avtomatik deploy qiladi.

---

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
