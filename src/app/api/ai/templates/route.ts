/**
 * GET /api/ai/templates
 * Returns the list of suggested template questions to seed the chat UI.
 */
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const TEMPLATES: { id: string; text: string; category: string }[] = [
  {
    id: 'tpl-dca',
    text: 'Apa itu Dollar Cost Averaging dan kapan strategi ini cocok?',
    category: 'edukatif',
  },
  {
    id: 'tpl-risk',
    text: 'Bagaimana cara mengukur profil risiko saya?',
    category: 'edukatif',
  },
  {
    id: 'tpl-rd-vs-ob',
    text: 'Apa perbedaan reksa dana saham dan obligasi?',
    category: 'analitik',
  },
  {
    id: 'tpl-per-pbv',
    text: 'Bagaimana cara membaca rasio PER dan PBV?',
    category: 'edukatif',
  },
  {
    id: 'tpl-nondisc',
    text: 'Apa itu layanan advisory non-diskrisioner?',
    category: 'regulasi',
  },
  {
    id: 'tpl-impulse',
    text: 'Bagaimana cara menghindari pembelian impulsif?',
    category: 'analitik',
  },
  {
    id: 'tpl-banking',
    text: 'Bagaimana kondisi sektor perbankan Indonesia saat ini?',
    category: 'faktual',
  },
  {
    id: 'tpl-pdp',
    text: 'Apa hak saya terkait data pribadi sebagai investor?',
    category: 'regulasi',
  },
]

export async function GET() {
  return NextResponse.json({ templates: TEMPLATES })
}
