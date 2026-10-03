import { api } from './api'
import type { Term } from './examsApi'

export type FeeStatus = 'PAID' | 'PART' | 'UNPAID' | 'NO_FEES'
export const METHODS = ['CASH', 'TRANSFER', 'POS', 'CHEQUE'] as const
export type Method = (typeof METHODS)[number]
export const METHOD_LABEL: Record<Method, string> = { CASH: 'Cash', TRANSFER: 'Bank transfer', POS: 'POS', CHEQUE: 'Cheque' }

export interface FeeItem { name: string; amount: number }

export interface ClassFees {
  classId: string
  name: string
  scheduleId: string | null
  items: FeeItem[]
  perStudent: number | null
  dueDate: string | null
  students: number
  expected: number
  collected: number
  outstanding: number
  paidInFull: number
}

export interface StudentFees {
  id: string
  firstName: string
  lastName: string
  admissionNumber: string
  classId: string | null
  fees: number
  discount: number
  due: number
  paid: number
  balance: number
  status: FeeStatus
}

export interface FeesOverview {
  term: Term
  session: string
  totals: { expected: number; collected: number; outstanding: number; discounts: number; rate: number | null; owing: number; paidInFull: number }
  classes: ClassFees[]
  students: StudentFees[]
}

export interface SchoolInfo { name: string; address: string; phone: string; email: string }

export interface Statement {
  term: Term
  session: string
  school: SchoolInfo
  student: { id: string; firstName: string; lastName: string; admissionNumber: string; classId: string | null; className: string | null }
  items: FeeItem[]
  feesSet: boolean
  dueDate: string | null
  fees: number
  discount: { amount: number; reason: string | null } | null
  due: number
  paid: number
  balance: number
  payments: { id: string; receiptNumber: string; amount: number; method: Method; reference: string | null; paidOn: string; voided: boolean; voidReason: string | null }[]
}

export interface Receipt {
  id: string
  receiptNumber: string
  amount: number
  method: Method
  reference: string | null
  note: string | null
  paidOn: string
  term: Term
  session: string
  recordedByName: string
  voided: boolean
  voidReason: string | null
  school: SchoolInfo
  student: Statement['student']
  due: number
  paidToDate: number
  balanceAfter: number
}

export interface PaymentRow {
  id: string
  receiptNumber: string
  studentId: string
  studentName: string
  admissionNumber: string
  className: string | null
  amount: number
  method: Method
  reference: string | null
  paidOn: string
  recordedByName: string
  voided: boolean
  voidReason: string | null
}

export interface PaymentList {
  term: Term
  session: string
  total: number
  count: number
  byMethod: Partial<Record<Method, number>>
  payments: PaymentRow[]
}

export const getOverview = async (term: Term, session: string): Promise<FeesOverview> =>
  (await api.get('/fees/overview', { params: { term, session } })).data.data

export const getStatement = async (studentId: string, term: Term, session: string): Promise<Statement> =>
  (await api.get(`/fees/statement/${studentId}`, { params: { term, session } })).data.data

export const saveSchedule = async (body: { term: Term; session: string; classIds: string[]; items: FeeItem[]; dueDate?: string }) =>
  (await api.post('/fees/schedules', body)).data.data as { saved: number; total: number }

export const deleteSchedule = async (id: string) => {
  await api.delete(`/fees/schedules/${id}`)
}

export const saveDiscount = async (body: { term: Term; session: string; studentId: string; amount: number; reason?: string }) =>
  (await api.put('/fees/discounts', body)).data.data

export const listPayments = async (term: Term, session: string): Promise<PaymentList> =>
  (await api.get('/payments', { params: { term, session } })).data.data

export const getReceipt = async (id: string): Promise<Receipt> => (await api.get(`/payments/${id}`)).data.data

export const recordPayment = async (body: { studentId: string; term: Term; session: string; amount: number; method: Method; paidOn: string; reference?: string; note?: string }): Promise<Receipt> =>
  (await api.post('/payments', body)).data.data

export const voidPayment = async (id: string, reason: string): Promise<Receipt> => (await api.post(`/payments/${id}/void`, { reason })).data.data

export const naira = (n: number) => `₦${Math.round(n).toLocaleString('en-NG')}`

/** "85000", "85,000" or "₦85,000" -> 85000; null if it isn't a whole amount. */
export const parseNaira = (raw: string): number | null => {
  const v = raw.replace(/[₦,\s]/g, '')
  return /^\d{1,9}$/.test(v) ? Number(v) : null
}

export const FEE_STATUS_STYLE: Record<FeeStatus, { label: string; bg: string; fg: string }> = {
  PAID: { label: 'Paid', bg: '#e3f1e6', fg: '#1d5f36' },
  PART: { label: 'Part paid', bg: '#fdf0d5', fg: '#7a4c00' },
  UNPAID: { label: 'Not paid', bg: '#fbe4e2', fg: '#9b2a22' },
  NO_FEES: { label: 'No fees set', bg: '#efeee8', fg: '#646b64' },
}
