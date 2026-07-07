/**
 * FinBest AI - Database seed
 * Seeds: default user, knowledge base, assets, sample portfolio, behavior metrics
 */
import { Prisma, PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding FinBest AI database...')

  // 1. Default user
  const user = await prisma.userProfile.upsert({
    where: { email: 'demo@finbest.ai' },
    update: {},
    create: {
      email: 'demo@finbest.ai',
      name: 'Investor Demo',
      riskScore: 58,
      riskProfile: 'Moderat',
      horizonYears: 10,
      annualIncome: 180_000_000,
    },
  })
  console.log(`✓ User: ${user.email}`)

  // 2. Target allocation
  await prisma.targetAllocation.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      saham: 35,
      obligasi: 35,
      reksadana: 20,
      kas: 5,
      emas: 5,
    },
  })
  console.log('✓ Target allocation')

  // 3. Assets (Indonesian market instruments)
  const assets = [
    // Saham (Stocks)
    { ticker: 'BBCA', name: 'Bank Central Asia Tbk', type: 'SAHAM', sector: 'Perbankan', price: 9750, prevPrice: 9680, price5dAgo: 9420, volatility30d: 12.5 },
    { ticker: 'BBRI', name: 'Bank Rakyat Indonesia Tbk', type: 'SAHAM', sector: 'Perbankan', price: 4850, prevPrice: 4820, price5dAgo: 4780, volatility30d: 14.2 },
    { ticker: 'TLKM', name: 'Telkom Indonesia Tbk', type: 'SAHAM', sector: 'Telekomunikasi', price: 2780, prevPrice: 2790, price5dAgo: 2810, volatility30d: 9.8 },
    { ticker: 'ASII', name: 'Astra International Tbk', type: 'SAHAM', sector: 'Otomotif', price: 5120, prevPrice: 5080, price5dAgo: 4980, volatility30d: 11.3 },
    { ticker: 'GOTO', name: 'GoTo Gojek Tokopedia Tbk', type: 'SAHAM', sector: 'Teknologi', price: 67, prevPrice: 65, price5dAgo: 58, volatility30d: 28.7 },
    { ticker: 'EMTK', name: 'Elang Mahkota Teknologi Tbk', type: 'SAHAM', sector: 'Teknologi', price: 545, prevPrice: 520, price5dAgo: 462, volatility30d: 32.1 },
    { ticker: 'ICBP', name: 'Indofood CBP Sukses Makmur', type: 'SAHAM', sector: 'Konsumer', price: 11250, prevPrice: 11200, price5dAgo: 11100, volatility30d: 8.5 },
    { ticker: 'UNVR', name: 'Unilever Indonesia Tbk', type: 'SAHAM', sector: 'Konsumer', price: 2180, prevPrice: 2195, price5dAgo: 2240, volatility30d: 10.2 },
    // Obligasi (Bonds)
    { ticker: 'INDO23', name: 'Obligasi Pemerintah FR0091 10Y', type: 'OBLIGASI', sector: 'Pemerintah', price: 9850, prevPrice: 9840, price5dAgo: 9820, volatility30d: 3.2 },
    { ticker: 'INDO24', name: 'Obligasi Pemerintah FR0093 5Y', type: 'OBLIGASI', sector: 'Pemerintah', price: 9920, prevPrice: 9910, price5dAgo: 9900, volatility30d: 2.1 },
    // Reksa Dana (Mutual Funds)
    { ticker: 'RDSU', name: 'Sucorinvest Equity Fund', type: 'REKSADANA', sector: 'Saham', price: 1450, prevPrice: 1442, price5dAgo: 1410, volatility30d: 13.5 },
    { ticker: 'RDPU', name: 'Schroders Dana Likuid', type: 'REKSADANA', sector: 'Pasar Uang', price: 1280, prevPrice: 1279, price5dAgo: 1275, volatility30d: 1.8 },
    { ticker: 'RDFX', name: 'BNP Paribas Rupiah Plus', type: 'REKSADANA', sector: 'Pendapatan Tetap', price: 1120, prevPrice: 1118, price5dAgo: 1112, volatility30d: 4.5 },
    // Emas (Gold)
    { ticker: 'GLD001', name: 'Antam Logam Mulia 1gr', type: 'EMAS', sector: 'Komoditas', price: 1_345_000, prevPrice: 1_340_000, price5dAgo: 1_320_000, volatility30d: 7.8 },
    // Kas
    { ticker: 'CASH', name: 'Rupiah (Kas)', type: 'KAS', sector: 'Likuiditas', price: 1, prevPrice: 1, price5dAgo: 1, volatility30d: 0 },
  ]

  for (const a of assets) {
    await prisma.asset.upsert({
      where: { ticker: a.ticker },
      update: {},
      create: a,
    })
  }
  console.log(`✓ ${assets.length} assets`)

  // 4. Sample holdings (portfolio)
  const holdings = [
    { ticker: 'BBCA', quantity: 200, avgCost: 9200 },
    { ticker: 'BBRI', quantity: 500, avgCost: 4500 },
    { ticker: 'TLKM', quantity: 1000, avgCost: 2900 },
    { ticker: 'ASII', quantity: 300, avgCost: 5200 },
    { ticker: 'GOTO', quantity: 5000, avgCost: 60 },
    { ticker: 'ICBP', quantity: 100, avgCost: 10800 },
    { ticker: 'INDO23', quantity: 100, avgCost: 9800 },
    { ticker: 'RDSU', quantity: 1000, avgCost: 1380 },
    { ticker: 'RDPU', quantity: 2000, avgCost: 1260 },
    { ticker: 'GLD001', quantity: 10, avgCost: 1_280_000 },
    { ticker: 'CASH', quantity: 15_000_000, avgCost: 1 },
  ]

  for (const h of holdings) {
    const asset = await prisma.asset.findUnique({ where: { ticker: h.ticker } })
    if (!asset) continue
    await prisma.holding.create({
      data: {
        userId: user.id,
        assetId: asset.id,
        quantity: h.quantity,
        avgCost: h.avgCost,
      },
    })
  }
  console.log(`✓ ${holdings.length} holdings`)

  // 5. Sample transactions (history for behavior analysis)
  const txAssets = await prisma.asset.findMany()
  const sampleTx = [
    { ticker: 'BBCA', side: 'BUY', qty: 100, daysAgo: 1 },
    { ticker: 'GOTO', side: 'BUY', qty: 2000, daysAgo: 2 },
    { ticker: 'TLKM', side: 'SELL', qty: 200, daysAgo: 3 },
    { ticker: 'BBRI', side: 'BUY', qty: 100, daysAgo: 5 },
    { ticker: 'EMTK', side: 'BUY', qty: 500, daysAgo: 6 },
    { ticker: 'RDSU', side: 'BUY', qty: 500, daysAgo: 8 },
    { ticker: 'ICBP', side: 'SELL', qty: 50, daysAgo: 10 },
    { ticker: 'ASII', side: 'BUY', qty: 100, daysAgo: 12 },
  ]
  for (const tx of sampleTx) {
    const asset = txAssets.find((a) => a.ticker === tx.ticker)
    if (!asset) continue
    await prisma.transaction.create({
      data: {
        userId: user.id,
        assetId: asset.id,
        side: tx.side,
        quantity: tx.qty,
        price: asset.price,
        status: 'EXECUTED',
        executedAt: new Date(Date.now() - tx.daysAgo * 86400000),
      },
    })
  }
  console.log(`✓ ${sampleTx.length} transactions`)

  // 6. Behavior metrics (30 days Traction Score trend)
  const behaviorData: Prisma.BehaviorMetricCreateManyInput[] = []
  for (let i = 29; i >= 0; i--) {
    const baseScore = 65 + Math.sin(i / 4) * 15 + (Math.random() - 0.5) * 8
    behaviorData.push({
      userId: user.id,
      date: new Date(Date.now() - i * 86400000),
      tractionScore: Math.max(20, Math.min(95, Math.round(baseScore))),
      transactionCount: Math.floor(Math.random() * 4),
      impulsiveCount: Math.random() > 0.7 ? 1 : 0,
    })
  }
  await prisma.behaviorMetric.createMany({ data: behaviorData })
  console.log(`✓ 30 days behavior metrics`)

  // 7. Sample insights
  const insights = [
    {
      userId: user.id,
      type: 'ALLOCATION',
      title: 'Alokasi saham melebihi target',
      description: 'Alokasi saham saat ini 42% dari target 35%. Pertimbangkan rebalancing untuk kembali ke rencana.',
      severity: 'warning',
    },
    {
      userId: user.id,
      type: 'BEHAVIOR',
      title: 'Traction Score meningkat 7 hari terakhir',
      description: 'Rata-rata Traction Score minggu ini 78, naik dari 62 minggu lalu. Disiplin transaksi membaik.',
      severity: 'info',
    },
    {
      userId: user.id,
      type: 'RISK',
      title: 'Konsentrasi sektor perbankan tinggi',
      description: 'Eksposur sektor perbankan mencapai 31% (batas 25%). Pertimbangkan diversifikasi sektor.',
      severity: 'warning',
    },
  ]
  for (const ins of insights) {
    await prisma.insight.create({ data: ins })
  }
  console.log(`✓ ${insights.length} insights`)

  // 8. Knowledge base documents (RAG source)
  const knowledgeDocs = [
    {
      title: 'Panduan Edukasi Investor OJK: Profil Risiko Investor',
      category: 'education',
      source: 'OJK - Otoritas Jasa Keuangan',
      summary: 'Profil risiko investor diklasifikasikan menjadi 5 kategori berdasarkan kuesioner OJK: Konservatif, Moderat Konservatif, Moderat, Moderat Agresif, dan Agresif. Klasifikasi ini menjadi dasar penentuan alokasi aset yang sesuai.',
      content: `Berdasarkan Surat Edaran OJK tentang Profil Risiko Investor, terdapat 5 kategori profil risiko:

1. KONSERVATIF (skor 0-20): Investor yang mengutamakan perlindungan modal utama. Alokasi yang disarankan: kas dan deposito 50-70%, obligasi pemerintah 20-40%, saham maksimal 10%.

2. MODERAT KONSERVATIF (skor 21-40): Investor yang menerima fluktuasi kecil untuk return sedikit di atas deposito. Alokasi: obligasi 40-60%, saham 15-30%, reksa dana campuran 10-20%.

3. MODERAT (skor 41-60): Investor dengan toleransi risiko menengah yang menyeimbangkan pertumbuhan dan stabilitas. Alokasi: saham 30-50%, obligasi 30-40%, reksa dana 10-20%, kas 5-10%.

4. MODERAT AGRESIF (skor 61-80): Investor yang mengejar pertumbuhan modal dengan toleransi volatilitas tinggi. Alokasi: saham 50-70%, obligasi 15-25%, reksa dana saham 15-25%.

5. AGRESIF (skor 81-100): Investor dengan toleransi risiko tertinggi, fokus pertumbuhan jangka panjang. Alokasi: saham 70-90%, reksa dana saham 10-25%, obligasi maksimal 10%.

Kuesioner profil risiko OJK terdiri dari 10-13 pertanyaan yang mencakup: usia, horizon investasi, pendapatan, pengetahuan keuangan, pengalaman investasi, reaksi terhadap kerugian, dan sumber dana investasi.`,
    },
    {
      title: 'Regulasi OJK tentang Layanan Advisor Investasi Non-Diskrisioner',
      category: 'regulations',
      source: 'POJK Nomor 35/POJK.05/2022',
      summary: 'Layanan advisor investasi non-diskrisioner adalah layanan yang memberikan rekomendasi investasi namun keputusan dan eksekusi tetap pada nasabah. Berbeda dengan advisor diskresioner yang berwenang mengeksekusi transaksi.',
      content: `Berdasarkan POJK Nomor 35 Tahun 2022 tentang Penyelenggaraan Layanan Advisory Alternatif:

DEFINISI NON-DISKRISIONER:
Layanan advisory non-diskrisioner memberikan rekomendasi investasi kepada nasabah, namun keputusan akhir dan eksekusi transaksi sepenuhnya berada di tangan nasabah. Penyedia layanan tidak berwenang mengeksekusi transaksi atas nama nasabah.

KEWAJIBAN PENYEDIA LAYANAN:
1. Memberikan disclaimer yang jelas bahwa saran bersifat edukatif
2. Tidak menjanjikan return pasti
3. Menyediakan audit trail untuk seluruh rekomendasi
4. Melindungi data pribadi nasabah sesuai UU PDP
5. Menyediakan mekanisme feedback dan komplain

HAK PENGGUNA:
1. Hak akses atas seluruh data yang tersimpan
2. Hak untuk menghapus data (right to be forgotten)
3. Hak untuk mendapatkan penjelasan atas rekomendasi yang diberikan
4. Hak untuk menolak rekomendasi tanpa konsekuensi

LARANGAN:
1. Memberikan rekomendasi transaksi spesifik tanpa dasar analisis
2. Menjanjikan atau menjamin return investasi
3. Memprediksi pergerakan harga dengan kepastian
4. Memberikan saran yang melanggar regulasi pasar modal`,
    },
    {
      title: 'Edukasi: Apa itu Dollar Cost Averaging (DCA) dan Strateginya',
      category: 'education',
      source: 'FinBest AI Knowledge Base',
      summary: 'Dollar Cost Averaging adalah strategi investasi dengan membeli aset secara berkala dalam jumlah nominal tetap, terlepas dari kondisi pasar. Strategi ini membantu mengurangi risiko timing pasar dan emosi investasi.',
      content: `Dollar Cost Averaging (DCA) adalah strategi investasi di mana investor membeli aset dalam jumlah nominal tetap secara berkala (misalnya bulanan), terlepas dari harga pasar saat itu.

KEUNGGULAN DCA:
1. Mengurangi risiko timing pasar - tidak perlu menebak kapan harga terendah
2. Membeli lebih banyak unit saat harga rendah, lebih sedikit saat harga tinggi
3. Mendisiplinkan investor untuk investasi konsisten
4. Mengurangi keputusan emosional (FOMO/panik)
5. Cocok untuk investor pemula dengan dana berkala

CONTOH DCA:
Investor A membeli reksa dana Rp 1.000.000 setiap bulan:
- Bulan 1: NAV Rp 1.000 → beli 1.000 unit
- Bulan 2: NAV Rp 800 → beli 1.250 unit
- Bulan 3: NAV Rp 1.200 → beli 833 unit
Total: 3.083 unit dengan rata-rata biaya Rp 973/unit

PERBEDAAN DCA vs LUMP SUM:
- DCA: investasi bertahap, mengurangi volatilitas psikologis
- Lump Sum: investasi sekaligus, potensi return lebih tinggi jika timing tepat
- Studi menunjukkan lump sum unggul ~67% kasus di pasar yang trending naik

KAPAN DCA COCOK:
- Investor dengan pendapatan berkala (gaji)
- Investor yang ingin mengurangi stres timing pasar
- Horizon investasi panjang (>5 tahun)
- Investor pemula yang ingin membangun kebiasaan investasi`,
    },
    {
      title: 'Analisis Sektor Perbankan Indonesia 2026',
      category: 'financials',
      source: 'Riset FinBest AI - Q1 2026',
      summary: 'Sektor perbankan Indonesia menunjukkan pertumbuhan moderat dengan NIM stabil di kisaran 4.5-5.2%. Rasio kredit bermasalah (NPL) terjaga di 2.8%. Bank digital dan kredit UMKM menjadi pendorong pertumbuhan.',
      content: `RINGKASAN SEKTOR PERBANKAN INDONESIA Q1 2026:

PERFORMA KEUANGAN:
- Pertumbuhan kredit YoY: 9.8% (vs 11.2% Q4 2025)
- Net Interest Margin (NIM) rata-rata: 4.85%
- Non-Performing Loan (NPL): 2.8% (terjaga)
- Return on Equity (ROE) rata-rata: 13.2%
- Capital Adequacy Ratio (CAR): 23.1% (jauh di atas minimum 8%)

FAKTOR PENDORONG:
1. Ekspansi kredit UMKM tumbuh 12.5%
2. Adopsi perbankan digital meningkat, biaya operasional turun
3. Bunga SBN masih relatif tinggi, mendukung income dari portofolio surat berharga
4. Program pemerintah KUR mendukung penyaluran kredit

RISIKO & TANTANGAN:
1. Perlambatan ekonomi global dapat tekan ekspor
2. Potensi kenaikan suku bunga BI mempengaruhi biaya dana
3. Konsentrasi kredit pada sektor properti perlu diawasi
4. Persaingan bank digital menekan margin

BANK TERSELEKSI (kapitalisasi besar):
- BBCA: ROE 24%, NPL 1.9%, valuasi PER 6.8x
- BBRI: ROE 18%, fokus UMKM, ekspansi digital
- BMRI: ROE 15%, korporasi, jaringan internasional
- BBNI: ROE 14%, korporasi & consumer

KESIMPULAN:
Sektor perbankan fundamental sehat dengan pertumbuhan moderat. Valuasi saat ini mengindikasikan harga wajar. Investor perlu mempertimbangkan profil risiko dan alokasi target sebelum memutuskan eksposur sektor.`,
    },
    {
      title: 'Prospectus: Reksa Dana Sucorinvest Equity Fund',
      category: 'prospectus',
      source: 'Sucorinvest Asset Management - 2026',
      summary: 'Reksa dana saham dengan fokus saham-saham berkualitas di Bursa Efek Indonesia. Tujuan pertumbuhan jangka panjang melalui investasi minimal 80% di saham. Biaya manajemen 1.5% per tahun.',
      content: `PROSPEKTUS REKSA DANA SUCORINVEST EQUITY FUND:

INFORMASI DASAR:
- Jenis: Reksa Dana Saham
- Tujuan investasi: Pertumbuhan nilai investasi jangka panjang
- Bank Kustodian: BNI Sekuritas
- Manajer Investasi: Sucorinvest Asset Management
- Tanggal peluncuran: 15 Januari 2015
- AUM: Rp 2.8 triliun (per Maret 2026)

STRATEGI INVESTASI:
Minimal 80% portofolio diinvestasikan pada saham-saham berkualitas yang diperdagangkan di Bursa Efek Indonesia (BEI). Seleksi saham berdasarkan analisis fundamental dengan pendekatan bottom-up, fokus pada perusahaan dengan:
- Pertumbuhan laba konsisten >15% per tahun
- ROE >15%
- Valuasi wajar (PER <15x)
- Kualitas manajemen dan tata kelola baik

ALOKASI PORTOFOLIO (per Maret 2026):
- Sektor Keuangan: 32%
- Sektor Konsumer: 24%
- Sektor Energi: 15%
- Sektor Telekomunikasi: 12%
- Sektor Industri: 10%
- Kas & setara kas: 7%

PERFORMA HISTORIS:
- 1 tahun: +18.5%
- 3 tahun (CAGR): +12.3%
- 5 tahun (CAGR): +9.8%
- Sejak peluncuran (CAGR): +11.2%
- Benchmark: IHSG (Composite Index)

BIAYA:
- Biaya manajemen: 1.5% per tahun
- Biaya kustodian: 0.1% per tahun
- Biaya pembelian: maksimal 2%
- Biaya penjualan: tiered (0.5-2% berdasarkan durasi hold)
- Switching fee: 0.5%

RISIKO:
1. Risiko pasar - fluktuasi harga saham
2. Risiko likuiditas - kesulitan menjual saham saat pasar turun
3. Risiko manajemen - keputusan investasi manager
4. Risiko konsentrasi - fokus pada saham-saham besar

CATATAN: Performa historis bukan jaminan performa masa depan. Reksa dana merupakan produk investasi yang tidak dijamin dan dapat mengalami penurunan nilai.`,
    },
    {
      title: 'Edukasi: Memahami Rasio Keuangan untuk Analisis Saham',
      category: 'education',
      source: 'FinBest AI Knowledge Base',
      summary: 'Rasio keuangan utama untuk analisis saham: PER (Price Earning Ratio), PBV (Price to Book Value), ROE (Return on Equity), DER (Debt to Equity Ratio). Setiap rasio memberikan insight valuasi dan kesehatan perusahaan.',
      content: `RASIO KEUANGAN UTAMA UNTUK ANALISIS SAHAM:

1. PRICE EARNING RATIO (PER)
- Rumus: Harga saham / EPS (Earning Per Share)
- Interpretasi: berapa kali investor mau membayar atas laba perusahaan
- PER rendah (5-10x): undervalued atau pertumbuhan lambat
- PER tinggi (20-30x): growth stock, ekspektasi pertumbuhan tinggi
- Bandingkan dengan PER rata-rata sektor dan historis perusahaan

2. PRICE TO BOOK VALUE (PBV)
- Rumus: Harga saham / Nilai Buku Per Saham
- Interpretasi: valuasi relatif terhadap ekuitas
- PBV < 1: saham trade di bawah nilai buku (potential value)
- PBV > 3: premium valuasi, biasanya perusahaan dengan ROE tinggi
- Relevan untuk sektor perbankan dan aset berat

3. RETURN ON EQUITY (ROE)
- Rumus: Laba Bersih / Ekuitas
- Interpretasi: profitabilitas atas modal pemegang saham
- ROE > 15%: kinerja baik
- ROE > 20%: kinerja sangat baik
- Konsistensi ROE penting, bukan satu titik waktu

4. DEBT TO EQUITY RATIO (DER)
- Rumus: Total Hutang / Ekuitas
- Interpretasi: tingkat leverage perusahaan
- DER < 1: sehat, hutang lebih rendah dari modal
- DER 1-2: moderat, perlu evaluasi struktur modal
- DER > 3: berisiko, eksposur terhadap suku bunga tinggi

5. DIVIDEND YIELD
- Rumus: Dividen Per Saham / Harga Saham
- Interpretasi: return dari dividen
- Yield 2-4%: wajar untuk pasar Indonesia
- Yield > 6%: tinggi, perlu cek keberlanjutan dividen

6. CURRENT RATIO
- Rumus: Aset Lancar / Hutang Lancar
- Interpretasi: kemampuan membayar kewajiban jangka pendek
- > 1.5: likuiditas sehat
- < 1: potensi kesulitan likuiditas

TIPS ANALISIS:
- Jangan gunakan satu rasio saja, gunakan kombinasi
- Bandingkan dengan peer di sektor yang sama
- Lihat tren 3-5 tahun, bukan hanya tahun terakhir
- Kaitkan dengan model bisnis perusahaan
- Perhatikan kualitas laporan keuangan (audit big 4)`,
    },
    {
      title: 'UU Pelindungan Data Pribadi (UU PDP) Indonesia - Implikasi untuk Fintech',
      category: 'regulations',
      source: 'UU No. 27 Tahun 2022',
      summary: 'UU PDP mengatur pengolahan data pribadi di Indonesia. Pengguna memiliki hak akses, hak koreksi, hak penghapusan. Pengolahan data harus berdasarkan persetujuan dan prinsip minimalitas.',
      content: `UNDANG-UNDANG PELINDUNGAN DATA PRIBADI (UU PDP) INDONESIA:

DASAR HUKUM: UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi

PRINSIP UTAMA:
1. Pengolahan data yang sah, transparan, dan akuntabel
2. Minimalitas - hanya data yang diperlukan
3. Tujuan jelas dan terbatas
4. Akurasi dan keamanan data
5. Retensi data sesuai tujuan
6. Hak subjek data dihormati

HAK SUBJEK DATA (PENGGUNA):
1. Hak informasi tentang pengolahan data
2. Hak akses dan salinan data
3. Hak koreksi data yang tidak akurat
4. Hak penghapusan data (right to be forgotten)
5. Hak menolak pengolahan data
6. Hak menarik persetujuan
7. Hak portabilitas data

KEWAJIBAN PENGENDALI DATA (FINTECH):
1. Mendapatkan persetujuan eksplisit sebelum mengolah data
2. Memberikan informasi transparan tentang penggunaan data
3. Melakukan Assessment Dampak Perlindungan Data (DPIA)
4. Menunjuk Data Protection Officer (DPO)
5. Melaporkan pelanggaran data dalam 3x24 jam
6. Menjamin keamanan data dengan enkripsi
7. Menerapkan retention policy sesuai tujuan

PENERAPAN DI FINBEST AI:
1. Persetujuan eksplisit saat onboarding
2. Pengguna dapat mengakses dan ekspor seluruh data
3. Pengguna dapat menghapus akun dan seluruh data terkait
4. Data dienkripsi at-rest dan in-transit
5. Audit trail akses data untuk akuntabilitas
6. Retention: data transaksi 5 tahun (regulasi pajak), data profil selama akun aktif

SANKSI PELANGGARAN:
- Denda administratif hingga 2% dari pendapatan tahunan
- Sanksi pidana untuk pelanggaran berat (penjara 4-6 tahun)
- Denda pidana hingga Rp 6 miliar

CATATAN: Kepatuhan UU PDP adalah persyaratan utama untuk aplikasi fintech di Indonesia. FinBest AI mengimplementasikan seluruh hak subjek data sesuai regulasi.`,
    },
    {
      title: 'Edukasi: Behavioral Finance - Mitos dan Fakta Investasi',
      category: 'education',
      source: 'FinBest AI Knowledge Base',
      summary: 'Behavioral finance mempelajari bagaimana emosi dan bias psikologis mempengaruhi keputusan investasi. Bias umum: FOMO, loss aversion, herding, overconfidence, anchoring. Performance gap investor ritel umumnya 2-4% di bawah indeks.',
      content: `BEHAVIORAL FINANCE: PSIKOLOGI INVESTOR

PERFORMANCE GAP:
Studi Dalbar menunjukkan investor ritel mengalami "performance gap" rata-rata 2-4% per tahun di bawah return indeks acuan. Penyebab utama: keputusan emosional (beli di puncak, jual di dasar).

BIAS KOGNITIF UMUM:

1. FOMO (Fear of Missing Out)
- Membeli aset karena naik parah, takut ketinggalan
- Gejala: beli setelah kenaikan >15% dalam 5 hari
- Solusi: tunggu cooling-off, evaluasi fundamental

2. LOSS AVERSION
- Rasa sakit rugi 2x lebih kuat dari senang untung
- Gejala: tahan saham rugi terlalu lama, jual saham untung terlalu cepat
- Solusi: set stop-loss, fokus pada proses bukan outcome

3. HERD BEHAVIOR
- Mengikuti massa, tidak ingin sendirian
- Gejala: beli karena teman beli, jual karena media panik
- Solusi: punya thesis investasi sendiri

4. OVERCONFIDENCE
- Merasa bisa timing pasar
- Statistik: 95% trader aktif kalah dari indeks
- Solusi: investasi terstruktur, hindari trading berlebihan

5. ANCHORING
- Terpaku pada harga beli awal
- Gejala: menolak jual meski fundamental berubah
- Solusi: evaluasi berkala berdasarkan data terkini

6. RECENCY BIAS
- Memberi bobot berlebih pada event terbaru
- Gejala: panik setelah koreksi 1 minggu, euforia setelah rally
- Solusi: lihat data 5-10 tahun, bukan 1 bulan

7. CONFIRMATION BIAS
- Mencari informasi yang mendukung keputusan
- Solusi: cari counter-thesis, baca analisis kontra

TANDA-TANDA TRANSAKSI IMPULSIF:
- Frekuensi transaksi >2 deviasi standar dari rata-rata historis
- Membeli aset yang naik >15% dalam 5 hari
- Transaksi di luar rencana alokasi
- Volatilitas 30 hari di kuartil tertinggi

PENCEGAHAN DENGAN TRACTION:
1. Pre-trade check: evaluasi vs rencana
2. Cooling-off period: jeda 15-60 menit
3. Refleksi terstruktur: 2-3 pertanyaan
4. Traction Score: metrik 0-100
5. Audit trail: review berkala

FAKTA:
- Investor yang membaca prospektus performa 1.5% lebih baik
- Investor dengan rencana tertulis 2x lebih konsisten
- Investor yang tracking transaksi mengurangi impulsive trading 35%
- Diskon emosi: "jeda 24 jam" mengurangi pembelian impulsif 50%`,
    },
  ]

  for (const doc of knowledgeDocs) {
    await prisma.knowledgeDocument.create({ data: doc })
  }
  console.log(`✓ ${knowledgeDocs.length} knowledge documents`)

  console.log('\n✅ Seed complete!')
  console.log(`   Login as: ${user.email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
