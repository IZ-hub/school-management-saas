import { api } from './api'

export type BillingStatus = 'TRIAL' | 'ACTIVE' | 'DUE' | 'READ_ONLY'

export interface BillingInfo {
  status: BillingStatus
  trialEndsOn: string
  term: { term: 'FIRST' | 'SECOND' | 'THIRD'; session: string }
  dueOn: string | null
  readOnlyFrom: string | null
  paid: boolean
  enforced: boolean
  students: number
  pricePerStudent: number
  estimate: number
  paymentsEnabled: boolean
}

export interface Invoice { id: string; term: 'FIRST' | 'SECOND' | 'THIRD'; session: string; students: number; amount: number; status: 'OPEN' | 'PAID'; paidAt: unknown }

export const getBillingStatus = async (): Promise<BillingInfo> => (await api.get('/billing/status')).data.data
export const getBilling = async (): Promise<BillingInfo & { invoice: Invoice | null; history: Invoice[] }> => (await api.get('/billing')).data.data
export const startBillingPayment = async (): Promise<{ reference: string; authorizationUrl: string }> => (await api.post('/billing/pay')).data.data
export const verifyBillingPayment = async (reference: string): Promise<{ status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REVIEW' }> =>
  (await api.post('/billing/verify', { reference })).data.data

export const daysUntil = (iso: string) => Math.ceil((new Date(`${iso}T23:59:59`).getTime() - Date.now()) / 86_400_000)
export const prettyDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
