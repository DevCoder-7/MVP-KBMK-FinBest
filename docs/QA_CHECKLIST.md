# QA Checklist

Gunakan checklist ini sebelum demo, commit besar, atau deploy.

## Command Wajib

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Smoke Test Lokal

```bash
npm run dev
```

Buka:

```text
http://localhost:3002
```

## Area yang Harus Dicek

- Login/demo masuk ke `/app` tanpa Internal Server Error.
- Dashboard memuat ringkasan, insight, top positions, dan transaksi terbaru.
- Search bar atas menampilkan command palette, bukan redirect otomatis saat mengetik.
- Portofolio memuat posisi, alokasi, sektor, riwayat, dan tombol ekspor.
- Friction Gate memakai jeda adaptif sesuai risiko, delayed skip, dan bisa membuat evaluasi transaksi.
- AI Mentor rapi di desktop/tablet/mobile, sidebar dan context panel tidak overlap.
- Edukasi bisa membuka materi, tombol Tanya AI berfungsi, dan tombol lanjut bisa diklik.
- Profil bisa membuka risk questionnaire, tujuan, alokasi, import CSV, dan dialog broker.

## Responsive QA

Cek minimal viewport:

- Desktop: 1440 x 900
- Laptop: 1366 x 768
- Tablet: 768 x 1024
- Mobile: 390 x 844

Target:

- `pageOverflowX = 0`
- Tidak ada card/table yang menimpa section berikutnya.
- Daftar panjang memakai scroll internal.
- Modal/drawer punya body scroll dan footer tetap bisa diakses.

## Data dan Export

- Market badge menunjukkan live/fallback state dengan jelas.
- PDF report benar-benar mengunduh PDF, bukan JSON.
- CSV export memakai header yang dapat dibuka di spreadsheet.
- `.env` lokal tidak ikut commit.
