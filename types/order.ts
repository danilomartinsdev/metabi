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
  segment: 'Público' | 'Privado'
  pdvStatus: 'A' | 'PE'
  value: number
}

export interface DashboardData {
  orders: Order[]
  total: number
  orderCount: number
  averageTicket: number
  regions: { name: string; value: number; orders: number }[]
  managers: { name: string; value: number; orders: number }[]
  states: { name: string; region: string; value: number; orders: number }[]
  monthly: { month: string; value: number; orders: number }[]
  updatedAt: string
}
