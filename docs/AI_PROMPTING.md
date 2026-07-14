# AI Prompt Engineering

Dokumen ini menjelaskan lokasi, ownership, dan alur prompt AI Mentor FinBest.

## Lokasi Sumber Kebenaran

```text
src/lib/ai/prompts/
├── finbest-system.ts    # System prompt: identitas, safety, dan format global
├── finbest-analysis.ts  # Runtime prompt: query, tools, RAG, market, portfolio
├── index.ts             # Public export
└── README.md            # Aturan singkat untuk kontributor
```

Tidak ada prompt produksi yang perlu disalin ke komponen UI. Semua endpoint AI memakai service yang sama di `src/lib/ai-service.ts`.

## Alur Runtime

```text
AI Mentor UI
  -> /api/ai-finbest/chat atau /api/ai/chat
  -> src/lib/ai-service.ts
  -> knowledge retrieval + market data + portfolio + bias detection
  -> buildFinBestAnalysisPrompt(...)
  -> src/lib/ai-provider.ts
  -> Gemini atau GLM
  -> guardrailCheck(...)
  -> respons dan citation disimpan ke database
```

## Pembagian Tanggung Jawab

### System Prompt

Edit `src/lib/ai/prompts/finbest-system.ts` untuk perubahan yang berlaku pada semua permintaan:

- identitas dan tone FinBest;
- aturan non-diskrisioner;
- larangan halusinasi harga dan klaim profit;
- format default analisis saham;
- kewajiban menyebut provider, timestamp, dan ketidakpastian.

### Runtime Prompt

Edit `src/lib/ai/prompts/finbest-analysis.ts` untuk perubahan cara konteks disusun:

- pertanyaan pengguna;
- intent;
- daftar tools;
- knowledge base dan citation;
- market quote;
- analisis saham;
- portofolio pengguna;
- deteksi bias dan learning path.

### Provider dan Model

`src/lib/ai-provider.ts` memilih Gemini/GLM dan menerjemahkan role `system` menjadi `systemInstruction`. File ini bukan tempat menulis prompt bisnis.

### Guardrail dan Fallback

`src/lib/ai-service.ts` masih memiliki pemeriksaan output dan respons deterministik ketika provider gagal. Guardrail tidak menggantikan system prompt; keduanya harus diuji bersama.

## Checklist Review Prompt

Sebelum merge perubahan prompt, uji minimal:

1. Pertanyaan edukasi umum tidak memaksakan format analisis saham.
2. Pertanyaan harga saham memakai market quote kanonis, provider, dan timestamp.
3. Ketika market quote tidak tersedia, AI tidak menebak harga.
4. Permintaan BUY/HOLD/SELL dijawab sebagai skenario dan checklist, bukan instruksi final.
5. Pertanyaan FOMO, herding, overconfidence, loss aversion, dan anchoring memicu intervensi yang relevan.
6. Konteks portofolio hanya muncul ketika diperlukan.
7. Citation mengacu pada konteks yang benar-benar tersedia.
8. Output tetap menyatakan sifat non-diskrisioner.
9. Provider gagal menghasilkan fallback yang jujur dan tidak mengarang data.
10. Jalankan `npx tsc --noEmit`, `npm run lint`, dan `npm run build`.

## Praktik Perubahan

- Satu tujuan prompt per commit.
- Catat contoh input dan expected behavior di deskripsi pull request.
- Jangan menyimpan API key, connection string, data pribadi, atau harga statis di prompt.
- Jangan mengubah prompt langsung di Vercel; deployment harus berasal dari source GitHub yang dapat diaudit.
- Review perubahan prompt seperti perubahan kode karena dapat mengubah perilaku produk dan risiko kepatuhan.
