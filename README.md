# FinBest MVP Web

FinBest MVP Web adalah aplikasi edukasi dan asisten investasi non-diskrisioner untuk KBMK 2026. Aplikasi ini berfokus pada dashboard portofolio, data market, friction gate sebelum transaksi, AI Mentor, edukasi investor, dan profil risiko.

## Fitur Utama

- Dashboard ringkasan NAV, alokasi aset, insight perilaku, dan laporan.
- Portofolio dengan posisi, P&L, alokasi, sektor, riwayat, ekspor PDF/CSV, dan live market adapter.
- Friction Gate untuk evaluasi niat transaksi dengan jeda adaptif sesuai risiko.
- AI Mentor untuk tanya jawab investasi, analisis saham, deteksi bias, dan konteks portofolio.
- Edukasi dengan learning path, kuis mastery, dan integrasi tanya AI.
- Profil investor, target alokasi, tujuan keuangan, import CSV, dan simulasi broker read-only.

## Quick Start

```bash
npm install
npx prisma generate
npm run dev
```

Aplikasi berjalan di:

```text
http://localhost:3002
```

Gunakan `.env.example` sebagai template konfigurasi lokal.

Minimum environment variable:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require&connect_timeout=15"
DIRECT_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/neondb?sslmode=require&connect_timeout=15"
SESSION_SECRET="replace-with-a-long-random-secret"
```

## Script

```bash
npm run dev       # Next.js dev server di port 3002
npm run build     # Production build + standalone asset copy
npm run lint      # ESLint
npm run db:push   # Push Prisma schema ke database
```

## Struktur Repo

```text
.
├── docs/                 # Dokumentasi teknis, deployment, market data
├── prisma/               # Prisma schema dan seed data
├── public/               # Logo dan aset publik aplikasi
├── scripts/              # Helper build/deployment
├── src/
│   ├── app/              # Next.js App Router dan API routes
│   ├── components/       # UI, navigasi, dan modul fitur
│   └── lib/              # Store, auth, market data, AI service
├── .env.example          # Template environment variable
├── package.json
└── README.md
```

Folder generated/local seperti `.next/`, `node_modules/`, `db/`, `docs/archive/`, dan hasil QA tidak ikut commit.

## Dokumentasi

- [Deployment](docs/DEPLOYMENT.md)
- [Market Data](docs/MARKET_DATA.md)
- [Struktur Repo](docs/REPO_STRUCTURE.md)
- [QA Checklist](docs/QA_CHECKLIST.md)

## Catatan Database

MVP memakai PostgreSQL melalui Neon. Gunakan `DATABASE_URL` pooled untuk runtime aplikasi dan `DIRECT_URL` direct untuk operasi Prisma seperti `db push` atau migration.

## Status Verifikasi Terakhir

Perubahan terakhir sudah diverifikasi dengan:

```bash
npx tsc --noEmit
npm run lint
npm run build
```
