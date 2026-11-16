import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { dataPath, readOrders } from './orders'
import { SEGMENTS, type Order, type Representative, type RepresentativeSummary, type Segment } from '~/types/order'

// Representantes sem cadastro continuam como Privado (comportamento anterior).
export const DEFAULT_SEGMENT: Segment = 'Privado'

export function normalizeName(value: unknown) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().toUpperCase()
}

export function isSegment(value: unknown): value is Segment {
  return SEGMENTS.includes(value as Segment)
}

function representativesPath() {
  return join(dirname(dataPath()), 'representatives.json')
}

export async function readRepresentatives(): Promise<Representative[]> {
  try {
    const raw = JSON.parse(await fs.readFile(representativesPath(), 'utf8'))
    return Array.isArray(raw) ? raw.filter(r => r?.name && isSegment(r.segment)) : []
  } catch {
    return []
  }
}

export async function writeRepresentatives(list: Representative[]) {
  await fs.mkdir(dirname(representativesPath()), { recursive: true })
  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  await fs.writeFile(representativesPath(), JSON.stringify(sorted, null, 2), 'utf8')
}

// Pedidos com o segmento vindo do cadastro de representantes, aplicado na leitura:
// reclassificar um representante vale na hora para todo o histórico, sem reimportar.
export async function readClassifiedOrders(): Promise<Order[]> {
  const [orders, reps] = await Promise.all([readOrders(), readRepresentatives()])
  const segments = new Map(reps.map(r => [normalizeName(r.name), r.segment]))
  return orders.map(o => ({ ...o, segment: segments.get(normalizeName(o.manager)) || DEFAULT_SEGMENT }))
}

// Cadastrados + os que só aparecem nos pedidos importados.
export async function listRepresentatives(): Promise<RepresentativeSummary[]> {
  const [orders, reps] = await Promise.all([readOrders(), readRepresentatives()])
  const map = new Map<string, RepresentativeSummary>()
  for (const r of reps) map.set(normalizeName(r.name), { name: r.name, segment: r.segment, registered: true, orders: 0, value: 0 })
  for (const o of orders) {
    const key = normalizeName(o.manager)
    const item = map.get(key) || { name: o.manager, segment: DEFAULT_SEGMENT, registered: false, orders: 0, value: 0 }
    item.orders += 1
    item.value += o.value || 0
    map.set(key, item)
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
}
