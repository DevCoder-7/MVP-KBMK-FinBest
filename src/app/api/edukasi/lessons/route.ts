import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getDefaultUser } from '@/lib/api-helpers'

/**
 * GET /api/edukasi/lessons
 * Returns adaptive learning pathways with spaced repetition support.
 * Lessons organized by difficulty: Pemula -> Menengah -> Lanjut
 */
export async function GET() {
  try {
    const user = await getDefaultUser()

    // Get user's progress (tracked in Insight table as type 'LESSON_PROGRESS')
    const progress = await db.insight.findMany({
      where: { userId: user.id, type: 'LESSON_PROGRESS' },
    })
    const completedLessons = new Set(progress.map((p) => p.title))

    const lessons = LESSONS.map((lesson) => ({
      ...lesson,
      completed: completedLessons.has(lesson.id),
    }))

    // Calculate path stats
    const totalLessons = lessons.length
    const completedCount = lessons.filter((l) => l.completed).length
    const progressPct = (completedCount / totalLessons) * 100

    // Recommend next lesson (first incomplete in order)
    const nextLesson = lessons.find((l) => !l.completed) || lessons[0]

    // Spaced repetition: lessons due for review (completed > 7 days ago)
    const dueForReview = lessons.filter((l) => {
      if (!l.completed) return false
      const p = progress.find((pr) => pr.title === l.id)
      if (!p) return false
      const daysSince = (Date.now() - new Date(p.createdAt).getTime()) / (1000 * 60 * 60 * 24)
      return daysSince > 7
    })

    return NextResponse.json({
      lessons,
      stats: {
        total: totalLessons,
        completed: completedCount,
        progressPct: Math.round(progressPct),
        dueForReview: dueForReview.length,
      },
      nextLesson,
      dueForReview,
    })
  } catch (error) {
    console.error('GET /api/edukasi/lessons error:', error)
    return NextResponse.json({ error: 'Gagal memuat lessons' }, { status: 500 })
  }
}

interface Lesson {
  id: string
  title: string
  description: string
  difficulty: 'Pemula' | 'Menengah' | 'Lanjut'
  duration: number // minutes
  category: string
  keyPoints: string[]
  content: string[]
  quiz: { question: string; options: string[]; correct: number; explanation: string }[]
}

const LESSONS: Lesson[] = [
  {
    id: 'lesson-01',
    title: 'Dasar Pasar Modal Indonesia',
    description: 'Memahami saham, obligasi, reksa dana, dan mekanisme BEI',
    difficulty: 'Pemula',
    duration: 8,
    category: 'Fundamental',
    keyPoints: [
      'Pasar modal diatur OJK, dengan BEI sebagai bursa, KSEI sebagai kustodian',
      'Saham = kepemilikan perusahaan, Obligasi = pinjaman, Reksa Dana = portofolio kolektif',
      'Jam perdagangan BEI: 09:00-15:00 WIB, Senin-Jumat',
      'Investor ritel Indonesia mencapai 20,13 juta SID per 2025',
    ],
    content: [
      'Pasar modal adalah tempat perdagangan instrumen keuangan jangka panjang seperti saham, obligasi, dan reksa dana.',
      'Di Indonesia, pasar modal diatur oleh Otoritas Jasa Keuangan (OJK). Bursa Efek Indonesia (BEI) menyediakan tempat perdagangan, KSEI sebagai kustodian penyimpanan, dan KPEI sebagai lembaga kliring.',
      'Saham: bukti kepemilikan perusahaan. Harga naik jika perusahaan tumbuh, turun jika kinerja memburuk. Investor mendapat dividen dan capital gain.',
      'Obligasi: pinjaman kepada pemerintah atau perusahaan. Investor mendapat kupon (bunga) berkala dan pokok di maturity. Risiko lebih rendah dari saham.',
      'Reksa Dana: portofolio kolektif yang dikelola manajer investasi. Cocok untuk pemula karena diversifikasi otomatis. Jenis: saham, campuran, pendapatan tetap, pasar uang.',
    ],
    quiz: [
      {
        question: 'Apa perbedaan utama saham dan obligasi?',
        options: [
          'Saham = pinjaman, Obligasi = kepemilikan',
          'Saham = kepemilikan, Obligasi = pinjaman',
          'Keduanya sama',
          'Saham hanya untuk institusi',
        ],
        correct: 1,
        explanation: 'Saham adalah bukti kepemilikan perusahaan, sedangkan obligasi adalah surat pinjaman yang memberikan kupon berkala.',
      },
    ],
  },
  {
    id: 'lesson-02',
    title: 'Profil Risiko OJK: 5 Kategori Investor',
    description: 'Kuesioner 10 pertanyaan untuk tentukan profil risiko Anda',
    difficulty: 'Pemula',
    duration: 10,
    category: 'Profil Risiko',
    keyPoints: [
      '5 kategori: Konservatif, Moderat Konservatif, Moderat, Moderat Agresif, Agresif',
      'Skor 0-100 dipetakan ke 5 profil',
      'Profil menentukan alokasi aset yang sesuai',
      'Re-assessment minimal 1 tahun sekali (Wajib Paham OJK)',
    ],
    content: [
      'OJK mewajibkan setiap investor mengisi kuesioner profil risiko sebelum berinvestasi (Program Wajib Paham).',
      'Kuesioner mencakup: usia, horizon investasi, pendapatan, pengetahuan keuangan, pengalaman, reaksi terhadap kerugian, sumber dana.',
      '5 kategori profil: Konservatif (maks saham 10%), Moderat Konservatif (25%), Moderat (50%), Moderat Agresif (65%), Agresif (80%).',
      'Profil risiko bukan permanen. Re-assessment minimal 1 tahun sekali, atau saat ada perubahan signifikan (pendapatan, tujuan, usia).',
      'FinBest AI memungkinkan re-assessment otomatis dengan notifikasi H-7, H-1, H+0.',
    ],
    quiz: [
      {
        question: 'Investor Konservatif sebaiknya memiliki alokasi saham maksimal berapa?',
        options: ['10%', '25%', '50%', '80%'],
        correct: 0,
        explanation: 'Profil Konservatif mengutamakan perlindungan modal, dengan alokasi saham maksimal 10% dan fokus pada deposito & SBN.',
      },
    ],
  },
  {
    id: 'lesson-03',
    title: 'Bias Kognitif: FOMO, Herding, Overconfidence',
    description: 'Tiga bias paling merugikan investor Gen Z Indonesia',
    difficulty: 'Menengah',
    duration: 12,
    category: 'Behavioral Finance',
    keyPoints: [
      'FOMO: beli aset yang naik tinggi karena takut ketinggalan',
      'Herding: ikut massa atau influencer tanpa analisis',
      'Overconfidence: 95% trader aktif kalah dari indeks',
      'FinBest AI deteksi bias via NLP pattern matching',
    ],
    content: [
      'FOMO (Fear of Missing Out): Kecemasan tertinggal tren profit mendorong beli aset yang sudah naik tinggi. Gejala: beli aset naik >15% dalam 5 hari, cek harga >5x/hari, beli tanpa analisis.',
      'Herding: Mengikuti keputusan massa atau influencer tanpa analisis mandiri. Gejala: beli karena trending di sosial media, ikut grup WhatsApp, jual saat semua orang jual.',
      'Overconfidence: Investor merasa bisa mengalahkan pasar. Statistik: 95% trader aktif kalah dari indeks dalam jangka panjang. Gejala: trading >20x/bulan, klaim profit tanpa dokumentasi.',
      'Penelitian: 55,38% investor Gen Z Indonesia terdorong FOMO (Lazuardi, 2025). Investor herding mengalami return 2-4% di bawah indeks (Sugianto et al., 2024).',
      'FinBest AI menggunakan Bias Detection Engine berbasis NLP untuk mendeteksi sinyal bias dari pertanyaan dan pola transaksi pengguna.',
    ],
    quiz: [
      {
        question: 'Apa persentase trader aktif yang kalah dari indeks dalam jangka panjang?',
        options: ['50%', '75%', '95%', '100%'],
        correct: 2,
        explanation: 'Studi multi-negara menunjukkan 95% day trader aktif kehilangan uang dalam jangka panjang karena overconfidence dan biaya transaksi.',
      },
    ],
  },
  {
    id: 'lesson-04',
    title: 'Analisis Fundamental: PER, PBV, ROE, DER',
    description: 'Rasio keuangan utama untuk valuasi saham',
    difficulty: 'Menengah',
    duration: 15,
    category: 'Analisis',
    keyPoints: [
      'PER < 10x undervalued, 10-20x wajar, > 30x premium',
      'PBV < 1 value opportunity, > 5 premium tinggi',
      'ROE > 15% baik, > 20% sangat baik',
      'DER < 1 sehat, > 3 berisiko',
    ],
    content: [
      'Analisis fundamental menilai nilai intrinsik saham berdasarkan laporan keuangan perusahaan.',
      'PER (Price Earning Ratio) = Harga saham / EPS. PER rendah bisa berarti undervalued atau pertumbuhan lambat. PER tinggi bisa berarti growth stock atau overvalued.',
      'PBV (Price to Book Value) = Harga / Nilai Buku. PBV < 1 artinya saham di bawah nilai buku (potential value). PBV > 3 artinya premium.',
      'ROE (Return on Equity) = Laba / Ekuitas. Mengukur profitabilitas atas modal pemegang saham. ROE > 15% baik, konsistensi 5 tahun lebih penting dari satu titik.',
      'DER (Debt to Equity Ratio) = Hutang / Ekuitas. DER < 1 sehat, 1-2 moderat, > 3 berisiko tinggi (paparan suku bunga).',
      'Contoh BBCA: PER 6.8x, PBV 2.1x, ROE 24%, DER rendah (perbankan). Kombinasi menunjukkan kualitas tinggi dengan valuasi wajar.',
    ],
    quiz: [
      {
        question: 'Saham dengan PER 8x, ROE 22%, DER 0.5. Bagaimana interpretasi awal?',
        options: [
          'Overvalued, risiko tinggi',
          'Undervalued, kualitas baik, keuangan sehat',
          'Tidak bisa dinilai',
          'Premium growth stock',
        ],
        correct: 1,
        explanation: 'PER 8x (rendah/undervalued), ROE 22% (profitabilitas sangat baik), DER 0.5 (keuangan sehat). Kombinasi mengindikasikan value stock berkualitas.',
      },
    ],
  },
  {
    id: 'lesson-05',
    title: 'Investasi ESG: Berkelanjutan & Bertanggung Jawab',
    description: 'Environmental, Social, Governance framework dari MSCI',
    difficulty: 'Menengah',
    duration: 10,
    category: 'ESG',
    keyPoints: [
      'ESG = Environmental, Social, Governance',
      'Skor MSCI: AAA-AA (Leader) hingga CCC (Laggard)',
      'Strategi: negative screening, positive screening, thematic, impact',
      'Pertumbuhan ESG Indonesia 89% per tahun (2024)',
    ],
    content: [
      'ESG adalah kerangka evaluasi investasi berdasarkan Environmental (lingkungan), Social (sosial), dan Governance (tata kelola).',
      'Environmental: emisi karbon, efisiensi energi, manajemen limbah. Social: kesehatan karyawan, keberagaman, hak buruh. Governance: struktur dewan, transparansi, etika bisnis.',
      'MSCI ESG Ratings: AAA-AA (Leader), A-BB (Average), BB-C (Laggard). Penilaian berdasarkan 10 tema.',
      'Strategi investasi ESG: (1) Negative screening - hindari tembakau/judi/senjata, (2) Positive screening - pilih ESG terbaik di sektor, (3) Thematic - clean energy/gender diversity, (4) Impact investing - dampak terukur.',
      'Pertumbuhan investasi ESG di Indonesia mencapai 89% per tahun (2024), menandakan kesadaran investor muda terhadap investasi berkelanjutan.',
    ],
    quiz: [
      {
        question: 'Apa itu negative screening dalam investasi ESG?',
        options: [
          'Menjual saham yang rugi',
          'Menghindari sektor kontroversial (tembakau, judi, senjata)',
          'Memilih saham dengan skor ESG tertinggi',
          'Investasi pada tema lingkungan',
        ],
        correct: 1,
        explanation: 'Negative screening adalah strategi menghindari sektor atau perusahaan yang kontroversial (tembakau, judi, senjata) dari portofolio.',
      },
    ],
  },
  {
    id: 'lesson-06',
    title: 'Analisis Teknikal: Trend, Support, Resistance',
    description: 'Membaca pergerakan harga dengan indikator teknikal',
    difficulty: 'Lanjut',
    duration: 15,
    category: 'Analisis',
    keyPoints: [
      'Trend: uptrend (higher highs), downtrend (lower highs)',
      'Support: level harga di mana tekanan beli > jual',
      'RSI > 70 overbought, < 30 oversold',
      'Kombinasikan fundamental + teknikal + risk management',
    ],
    content: [
      'Analisis teknikal membaca pergerakan harga dan volume untuk mengidentifikasi pola dan tren. Prinsip: harga diskon semua informasi, pergerakan membentuk tren, history repeats.',
      'Trend: Uptrend (higher highs + higher lows), Downtrend (lower highs + lower lows), Sidways (range). Identifikasi dengan trendline atau moving average.',
      'Support: level harga di mana tekanan beli > jual (harga cenderung bounce). Resistance: level di mana tekanan jual > beli (harga ditolak). Breakout = harga menembus level.',
      'Indikator: Moving Average (SMA 50/200, golden cross), RSI (0-100, > 70 overbought), MACD (momentum), Bollinger Bands (volatilitas).',
      'Keterbatasan: tidak 100% akurat, saham kecil/illiquid pola tidak reliable, "gorengan" menyesatkan. Strategi: fundamental untuk pilih saham, teknikal untuk timing, risk management untuk proteksi.',
    ],
    quiz: [
      {
        question: 'RSI saham menunjukkan 75. Apa interpretasinya?',
        options: [
          'Oversold, potensi rebound',
          'Overbought, potensi koreksi',
          'Saham wajar',
          'Tidak ada sinyal',
        ],
        correct: 1,
        explanation: 'RSI > 70 menandakan overbought, artinya harga mungkin sudah terlalu tinggi dan berpotensi koreksi. Bukan sinyal jual otomatis, perlu konfirmasi indikator lain.',
      },
    ],
  },
  {
    id: 'lesson-07',
    title: 'Diversifikasi & Alokasi Aset',
    description: 'Mengurangi risiko melalui sebaran investasi',
    difficulty: 'Menengah',
    duration: 10,
    category: 'Portofolio',
    keyPoints: [
      'Alokasi aset: Saham, Obligasi, Reksa Dana, Kas, Emas',
      'Diversifikasi: minimal 5 saham di 3 sektor',
      'Rebalancing: kuartalan untuk kembali ke target',
      'Batas konsentrasi sektor: 25% (PRD FR-2.1)',
    ],
    content: [
      'Alokasi aset adalah pembagian portofolio ke kelas aset berbeda: saham (growth), obligasi (stability), reksa dana (diversifikasi), kas (likuiditas), emas (hedge inflasi).',
      'Diversifikasi mengurangi risiko tanpa mengorbankan return. Aturan praktis: minimal 5 saham di 3 sektor berbeda. Batas konsentrasi sektor 25%, single position 10% NAV.',
      'Rebalancing: penyesuaian portofolio kembali ke target alokasi. Lakukan kuartalan atau saat deviasi > 10pp. Contoh: jika saham naik jadi 45% dari target 35%, jual sebagian dan beli aset lain.',
      'FinBest AI memantau konsentrasi sektor dan memberi peringatan jika melebihi 25%. Modul Traction juga mengevaluasi penyimpangan alokasi sebelum transaksi.',
    ],
    quiz: [
      {
        question: 'Berapa batas konsentrasi sektor default di FinBest AI?',
        options: ['10%', '25%', '50%', '100%'],
        correct: 1,
        explanation: 'Batas konsentrasi sektor default 25% sesuai PRD FR-2.1. Jika sektor melebihi 25%, Traction Score akan diberi penalti.',
      },
    ],
  },
  {
    id: 'lesson-08',
    title: 'Loss Aversion & Sunk Cost Fallacy',
    description: 'Mengatasi bias yang membuat investor menahan rugi',
    difficulty: 'Lanjut',
    duration: 12,
    category: 'Behavioral Finance',
    keyPoints: [
      'Loss aversion: rasa rugi 2x lebih sakit dari senang untung',
      'Sunk cost: melanjutkan karena sudah terlanjur',
      'Evaluasi berdasarkan prospek masa depan, bukan harga beli',
      'Cut loss = realokasi modal, bukan kekalahan',
    ],
    content: [
      'Loss Aversion (Kahneman & Tversky, 1979): Rasa sakit kerugian ~2x lebih kuat dari kepuasan keuntungan setara. Akibat: menahan saham rugi terlalu lama, jual saham untung terlalu cepat.',
      'Sunk Cost Fallacy: Melanjutkan investasi karena sudah "terlanjur" belanja/rugi, meski tidak rasional. "Saya sudah rugi Rp 5 juta, harus ditahan sampai balik."',
      'Strategi: (1) Set stop-loss disiplin (-10% atau -15%), (2) Evaluasi fundamental, bukan harga beli, (3) Tanyakan "Jika saya belum punya saham ini, apakah akan beli sekarang?", (4) Cut loss = realokasi modal ke investasi lebih menjanjikan.',
      'FinBest AI membantu melalui: pre-trade reflection questions di Traction, behavioral audit trail bulanan, edukasi terpersonalisasi berdasarkan pola transaksi.',
    ],
    quiz: [
      {
        question: 'Anda beli saham Rp 10.000, sekarang Rp 6.000. Fundamental memburuk. Apa yang harus dipertimbangkan?',
        options: [
          'Tahan karena pasti balik ke Rp 10.000',
          'Averaging down untuk turunkan cost',
          'Evaluasi prospek masa depan, bukan harga beli. Cut loss jika fundamental tidak pulih',
          'Jual semua dan jangan investasi lagi',
        ],
        correct: 2,
        explanation: 'Evaluasi berdasarkan prospek masa depan, bukan harga beli (anchoring/sunk cost). Jika fundamental tidak pulih, cut loss adalah realokasi modal yang rasional.',
      },
    ],
  },
]
