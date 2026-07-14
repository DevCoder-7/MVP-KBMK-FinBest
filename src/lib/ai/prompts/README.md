# FinBest Prompt Engineering

Folder ini adalah sumber kebenaran prompt yang dikirim ke model AI FinBest.

## File

- `finbest-system.ts` - identitas, batas non-diskrisioner, kebijakan sumber data, dan format jawaban global.
- `finbest-analysis.ts` - penyusun prompt runtime dari pertanyaan pengguna, hasil tools, RAG, data pasar, portofolio, dan deteksi bias.
- `index.ts` - public export untuk AI service.

## Aturan Perubahan

1. Jangan menaruh API key, data pengguna, atau nilai market statis di prompt.
2. Harga saham harus berasal dari market tool dan membawa provider serta timestamp.
3. Pertahankan batas non-diskrisioner dan larangan membuat klaim profit pasti.
4. Ubah satu tujuan dalam satu commit agar dampaknya dapat diuji dan diulas.
5. Setelah perubahan, jalankan type-check, lint, build, dan skenario QA pada `docs/AI_PROMPTING.md`.

Prompt global dikirim satu kali sebagai message dengan role `system`. Konteks per permintaan dikirim terpisah sebagai message dengan role `user`.
