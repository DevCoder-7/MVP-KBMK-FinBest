import { cp, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const standalone = join(root, '.next', 'standalone')

if (!existsSync(standalone)) {
  process.exit(0)
}

await mkdir(join(standalone, '.next'), { recursive: true })

const copies = [
  [join(root, '.next', 'static'), join(standalone, '.next', 'static')],
  [join(root, 'public'), join(standalone, 'public')],
]

for (const [from, to] of copies) {
  if (existsSync(from)) {
    await cp(from, to, { recursive: true, force: true })
  }
}
