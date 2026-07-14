# Struktur Repo

Repo ini memakai `App` sebagai root aplikasi Next.js. Struktur dibuat agar Vercel/GitHub dapat membaca project langsung dari root repo.

```text
.
├── docs/
│   ├── DEPLOYMENT.md
│   ├── AI_PROMPTING.md
│   ├── MARKET_DATA.md
│   ├── QA_CHECKLIST.md
│   └── REPO_STRUCTURE.md
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   ├── seed-account.ts
│   └── seed-knowledge.ts
├── public/
│   └── logo.svg
├── scripts/
│   └── copy-standalone-assets.mjs
├── src/
│   ├── app/
│   ├── components/
│   └── lib/
│       └── ai/
│           └── prompts/
├── .env.example
├── package.json
└── README.md
```

## Folder Runtime

- `src/app` berisi route, layout, halaman, dan API endpoint.
- `src/components/modules` berisi modul utama: dashboard, portofolio, friction gate, AI Mentor, edukasi, dan profil.
- `src/components/ui` berisi primitive UI shadcn/Radix.
- `src/lib` berisi helper bisnis: auth, store, AI service, finance utils, dan market data adapter.
- `src/lib/ai/prompts` adalah sumber kebenaran prompt engineering AI Mentor: system prompt dan penyusun konteks runtime.
- `prisma` berisi schema dan seed demo.
- `public` berisi aset publik yang dipakai runtime.

## Folder yang Tidak Di-commit

Folder/file berikut hanya untuk lokal atau hasil generate:

- `.next/`
- `node_modules/`
- `db/`
- `.qa-thumbs/`
- `.zscripts/`
- `agent-ctx/`
- `tool-results/`
- `download/`
- `upload/`
- `examples/`
- `mini-services/`
- `docs/archive/`

## Prinsip Struktur

- Dokumentasi human-facing masuk `docs/`.
- Source runtime tetap di `src/`, `prisma/`, `public/`, dan `scripts/`.
- File konfigurasi root hanya yang dibutuhkan build/deploy.
- Artifact hasil prototype extraction dan QA tidak masuk commit.
