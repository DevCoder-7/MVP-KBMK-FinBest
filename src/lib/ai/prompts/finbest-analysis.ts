export interface FinBestAnalysisPromptInput {
  query: string
  intent: {
    category: string
    confidence: number
  }
  toolsCalled: string[]
  contextBlock: string
  marketBlock: string
  stockBlock: string
  portfolioBlock: string
  biasBlock: string
  learningBlock: string
}

/** Build the per-request user message from trusted runtime context. */
export function buildFinBestAnalysisPrompt({
  query,
  intent,
  toolsCalled,
  contextBlock,
  marketBlock,
  stockBlock,
  portfolioBlock,
  biasBlock,
  learningBlock,
}: FinBestAnalysisPromptInput): string {
  return `MODE ANALISIS:
- Ikuti input pengguna secara langsung.
- Jika pengguna meminta BUY/HOLD/SELL, ubah permintaan tersebut menjadi dukungan keputusan: jelaskan data, tesis pro/kontra, risiko, dan skenario bersyarat tanpa memilihkan aksi final.
- Gunakan data dari tools, citations, market search, stock analysis, dan portfolio context.
- Harga saham kanonis hanya berasal dari ANALISIS SAHAM. Sebutkan provider dan timestamp. Jika data tidak lengkap, jangan menebak harga, target, atau stance transaksi.
- FinBest bersifat non-diskrisioner: keputusan dan eksekusi tetap sepenuhnya di tangan pengguna.

PERTANYAAN PENGGUNA:
${query}

INTENSI TERDETEKSI: ${intent.category} (keyakinan: ${intent.confidence})

TOOLS YANG DIPANGGIL:
${toolsCalled.map((tool) => `- ${tool}`).join('\n')}

REFERENSI KNOWLEDGE BASE (gunakan untuk citation [1], [2], dst):
${contextBlock}${marketBlock}${stockBlock}${portfolioBlock}${biasBlock}${learningBlock}

Berikan jawaban dengan citation. Jika bias terdeteksi, validasi emosi lalu beri intervensi singkat. Jika referensi tidak memadai, nyatakan dengan jujur dan berikan checklist data yang masih perlu diverifikasi.

PENTING: Jika pertanyaan tentang saham, sertakan status data, confidence analisis, 3 skenario bersyarat, analisis yang benar-benar didukung sumber, katalis, risk factors, dan checklist keputusan. Jangan membuat rekomendasi final BUY/HOLD/SELL/ACCUMULATE/REDUCE dan jangan membuat target/entry/stop-loss tanpa dasar data yang eksplisit.`
}
