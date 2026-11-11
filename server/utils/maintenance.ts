import { promises as fs } from 'node:fs'
import { dirname, join } from 'node:path'
import { dataPath } from './orders'

export interface MaintenanceState { active: boolean, message: string, since: string | null }

const DEFAULT_MESSAGE = 'Estamos realizando uma manutenção programada. Voltamos em breve.'

function maintenancePath() {
  return join(dirname(dataPath()), 'maintenance.json')
}

export async function readMaintenance(): Promise<MaintenanceState> {
  try {
    const raw = JSON.parse(await fs.readFile(maintenancePath(), 'utf8'))
    return { active: Boolean(raw.active), message: String(raw.message || DEFAULT_MESSAGE), since: raw.since || null }
  } catch {
    return { active: false, message: DEFAULT_MESSAGE, since: null }
  }
}

export async function writeMaintenance(active: boolean, message?: string): Promise<MaintenanceState> {
  const state: MaintenanceState = { active, message: (message || '').trim().slice(0, 300) || DEFAULT_MESSAGE, since: active ? new Date().toISOString() : null }
  await fs.mkdir(dirname(maintenancePath()), { recursive: true })
  await fs.writeFile(maintenancePath(), JSON.stringify(state, null, 2), 'utf8')
  return state
}
