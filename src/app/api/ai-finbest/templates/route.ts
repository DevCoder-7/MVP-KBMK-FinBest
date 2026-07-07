import { NextResponse } from 'next/server'

/** GET /api/ai-finbest/templates — template questions for AI FinBest */
export async function GET() {
  return NextResponse.json({
    templates: [
      {
        id: 't1',
        text: 'Apa itu Dollar Cost Averaging dan kapan strategi ini cocok?',
        category: 'Edukasi',
        icon: 'BookOpen',
      },
      {
        id: 't2',
        text: 'Analisis saham BBCA, bagus untuk investasi jangka panjang?',
        category: 'Analisis Saham',
        icon: 'LineChart',
      },
      {
        id: 't3',
        text: 'Saham GOTO naik gila-gilaan, harus beli ga sih?',
        category: 'Bias Detection',
        icon: 'Brain',
      },
      {
        id: 't4',
        text: 'Bagaimana cara membaca rasio PER dan PBV?',
        category: 'Edukasi',
        icon: 'Calculator',
      },
      {
        id: 't5',
        text: 'Apa itu investasi ESG dan mengapa penting?',
        category: 'ESG',
        icon: 'Leaf',
      },
      {
        id: 't6',
        text: 'Saya rugi 40% di saham, harus ditahan atau cut loss?',
        category: 'Bias Detection',
        icon: 'Brain',
      },
      {
        id: 't7',
        text: 'Bagaimana cara menyusun portofolio untuk pemula?',
        category: 'Edukasi',
        icon: 'PieChart',
      },
      {
        id: 't8',
        text: 'Evaluasi portofolio saya, apa yang perlu diperbaiki?',
        category: 'Mentor',
        icon: 'Target',
      },
    ],
  })
}
