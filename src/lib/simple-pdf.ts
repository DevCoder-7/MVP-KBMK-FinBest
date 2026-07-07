interface PdfSection {
  title: string
  lines: string[]
}

interface SimplePdfOptions {
  title: string
  subtitle?: string
  sections: PdfSection[]
  footer?: string
}

const PAGE_WIDTH = 595
const PAGE_HEIGHT = 842
const LEFT = 54
const TOP = 66
const LINE_HEIGHT = 16
const MAX_CHARS = 86
const MAX_LINES_PER_PAGE = 43

export function createSimplePdf(options: SimplePdfOptions): Buffer {
  const pages = paginate(buildLines(options))
  const objects: string[] = []

  objects.push('<< /Type /Catalog /Pages 2 0 R >>')
  const pageObjectIds = pages.map((_, index) => 3 + index * 2)
  objects.push(
    `<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
  )

  pages.forEach((lines, index) => {
    const pageId = 3 + index * 2
    const contentId = pageId + 1
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >> /Contents ${contentId} 0 R >>`
    )
    const stream = renderPage(lines, index + 1, pages.length)
    objects.push(`<< /Length ${Buffer.byteLength(stream, 'binary')} >>\nstream\n${stream}\nendstream`)
  })

  return serializePdf(objects)
}

function buildLines(options: SimplePdfOptions): string[] {
  const rows: string[] = []
  rows.push(`# ${options.title}`)
  if (options.subtitle) rows.push(options.subtitle)
  rows.push('')

  for (const section of options.sections) {
    rows.push(`## ${section.title}`)
    for (const line of section.lines) {
      wrap(line).forEach((wrapped) => rows.push(wrapped))
    }
    rows.push('')
  }

  if (options.footer) {
    rows.push('## Disclaimer')
    wrap(options.footer).forEach((line) => rows.push(line))
  }

  return rows
}

function paginate(lines: string[]): string[][] {
  const pages: string[][] = []
  for (let i = 0; i < lines.length; i += MAX_LINES_PER_PAGE) {
    pages.push(lines.slice(i, i + MAX_LINES_PER_PAGE))
  }
  return pages.length ? pages : [[]]
}

function renderPage(lines: string[], page: number, total: number): string {
  const commands: string[] = []
  commands.push('BT')
  commands.push(`${LEFT} ${PAGE_HEIGHT - TOP} Td`)

  lines.forEach((raw, index) => {
    const font = raw.startsWith('# ') || raw.startsWith('## ') ? '/F2 13 Tf' : '/F1 10 Tf'
    const text = raw.replace(/^##?\s/, '')
    if (index > 0) commands.push(`0 -${LINE_HEIGHT} Td`)
    commands.push(font)
    commands.push(`(${escapePdfText(text)}) Tj`)
  })

  commands.push('/F1 9 Tf')
  commands.push(`${PAGE_WIDTH - LEFT * 2} -${PAGE_HEIGHT - TOP * 2 - lines.length * LINE_HEIGHT + 18} Td`)
  commands.push(`(Halaman ${page}/${total}) Tj`)
  commands.push('ET')
  return commands.join('\n')
}

function serializePdf(objects: string[]): Buffer {
  let pdf = '%PDF-1.4\n'
  const offsets = [0]

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'binary'))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  })

  const xrefOffset = Buffer.byteLength(pdf, 'binary')
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += '0000000000 65535 f \n'
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`
  })
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  return Buffer.from(pdf, 'binary')
}

function wrap(value: string): string[] {
  const normalized = sanitizeText(value)
  const lines: string[] = []
  let current = ''

  for (const word of normalized.split(/\s+/)) {
    if (!word) continue
    const next = current ? `${current} ${word}` : word
    if (next.length > MAX_CHARS) {
      if (current) lines.push(current)
      current = word
    } else {
      current = next
    }
  }

  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

function escapePdfText(value: string): string {
  return sanitizeText(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}

function sanitizeText(value: string): string {
  return String(value)
    .replace(/\u2013|\u2014/g, '-')
    .replace(/\u2022/g, '-')
    .replace(/\u00a0/g, ' ')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
}
