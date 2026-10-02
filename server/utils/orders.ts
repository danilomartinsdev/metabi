import { promises as fs } from 'node:fs'
import { dirname, resolve } from 'node:path'
import * as XLSX from 'xlsx/xlsx.mjs'
import type { Order } from '~/types/order'

const regions: Record<string, string> = {
  AC: 'Norte', AL: 'Nordeste', AP: 'Norte', AM: 'Norte', BA: 'Nordeste',
  CE: 'Nordeste', DF: 'Centro-Oeste', ES: 'Sudeste', GO: 'Centro-Oeste',
  MA: 'Nordeste', MT: 'Centro-Oeste', MS: 'Centro-Oeste', MG: 'Sudeste',
  PA: 'Norte', PB: 'Nordeste', PR: 'Sul', PE: 'Nordeste', PI: 'Nordeste',
  RJ: 'Sudeste', RN: 'Nordeste', RS: 'Sul', RO: 'Norte', RR: 'Norte',
  SC: 'Sul', SP: 'Sudeste', SE: 'Nordeste', TO: 'Norte'
}

export function dataPath() {
  return resolve(process.cwd(), useRuntimeConfig().dataFile)
}

export async function readOrders(): Promise<Order[]> {
  try {
    return JSON.parse(await fs.readFile(dataPath(), 'utf8')) as Order[]
  } catch {
    return []
  }
}

export async function writeOrders(orders: Order[]) {
  await fs.mkdir(dirname(dataPath()), { recursive: true })
  await fs.writeFile(dataPath(), JSON.stringify(orders, null, 2), 'utf8')
}

function excelDate(value: unknown): string {
  if (typeof value === 'number') {
    const date = new Date(Math.round((value - 25569) * 86400 * 1000))
    return date.toISOString().slice(0, 10)
  }
  const text = String(value ?? '').trim()
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/)
  if (match) return `${match[3].length === 2 ? `20${match[3]}` : match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`
  return text
}

function clean(value: unknown) {
  return String(value ?? '').replace(/\uFFFD/g, '').trim()
}

export function parseWorkbook(buffer: Buffer): Order[] {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false })
  const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' })
  const data = rows.slice(1) as unknown[][]
  return data.filter(row => row[0] || row[1]).map((row, index) => {
    const uf = clean(row[7]).toUpperCase()
    const value = typeof row[9] === 'number' ? row[9] : Number(String(row[9]).replace(/[^\d,-]/g, '').replace(',', '.')) || 0
    return {
      id: clean(row[0]) || `import-${index + 1}`,
      orderNumber: clean(row[1]),
      cprOrder: clean(row[2]),
      issueDate: excelDate(row[3]),
      deliveryDate: excelDate(row[4]),
      pdv: clean(row[5]).toUpperCase() === 'PE' ? 'PE' : 'A',
      client: clean(row[6]),
      uf,
      region: regions[uf] || 'Não informado',
      manager: clean(row[8]) || 'Não informado',
      segment: 'Privado',
      pdvStatus: clean(row[5]).toUpperCase() === 'PE' ? 'PE' : 'A',
      value
    } satisfies Order
  })
}
