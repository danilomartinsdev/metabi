export type Segment = 'Público' | 'Privado'

export const SEGMENTS: Segment[] = ['Público', 'Privado']

export interface Order {
  id: string
  orderNumber: string
  cprOrder: string
  issueDate: string
  deliveryDate: string
  pdv: string
  client: string
  uf: string
  region: string
  manager: string
  segment: Segment
  pdvStatus: 'A' | 'PE'
  value: number
}

export interface Aggregate { name: string; value: number; orders: number }

export interface DashboardData {
  orders: Order[]
  total: number
  orderCount: number
  averageTicket: number
  regions: Aggregate[]
  managers: Aggregate[]
  states: (Aggregate & { region: string })[]
  segments: Aggregate[]
  clients: Aggregate[]
  monthly: { month: string; value: number; orders: number }[]
  updatedAt: string
}

// Cadastro de representante. O segmento vale para todos os pedidos dele.
export interface Representative {
  name: string
  segment: Segment
  createdAt: string
  updatedAt: string
}

export interface RepresentativeSummary {
  name: string
  segment: Segment
  registered: boolean
  orders: number
  value: number
}

export interface ClientSummary extends Aggregate { lastOrder: string; segment: Segment | 'Misto' }

export interface ClientDetail {
  name: string
  total: number
  orderCount: number
  averageTicket: number
  firstOrder: string
  lastOrder: string
  managers: Aggregate[]
  states: Aggregate[]
  segments: Aggregate[]
  monthly: { month: string; value: number; orders: number }[]
  orders: Order[]
}
