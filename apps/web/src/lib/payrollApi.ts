import { api } from './api'

export interface PayItem { label: string; amount: number }
export type PayMethod = 'TRANSFER' | 'CASH' | 'CHEQUE'
export const PAY_METHOD: Record<PayMethod, string> = { TRANSFER: 'Bank transfer', CASH: 'Cash', CHEQUE: 'Cheque' }

/** A staff member with their standing pay details. Keys: T_ teacher, U_ staff account, O_ other staff. */
export interface PayPerson {
  key: string
  firstName: string
  lastName: string
  role: string
  number: string
  email: string
  basic: number
  allowances: PayItem[]
  deductions: PayItem[]
  bankName: string
  accountNumber: string
  accountName: string
  gross: number
  net: number
}

export interface PayLine {
  key: string
  name: string
  role: string
  number: string
  email: string
  basic: number
  allowances: PayItem[]
  deductions: PayItem[]
  extraPay: PayItem[]
  extraDeductions: PayItem[]
  lateDays: number
  lateDeduction: number
  waiveLateness: boolean
  excluded: boolean
  bankName: string
  accountNumber: string
  accountName: string
  gross: number
  totalDeductions: number
  net: number
  paid: { on: string; method: PayMethod; reference: string | null } | null
}

export interface RunSummary {
  month: string
  label: string
  status: 'DRAFT' | 'APPROVED'
  people: number
  gross: number
  deductions: number
  net: number
  paidCount: number
  paidAmount: number
}

export interface PayrollSchool { name: string; logo: string | null; address: string; phone: string; email: string }
export interface PayrollSettings { latePenalty: number | null; freeLates: number }

export interface Run extends RunSummary {
  createdByName: string | null
  approvedByName: string | null
  settings: PayrollSettings
  school: PayrollSchool
  lines: PayLine[]
}

export interface OtherStaff { id: string; key: string; firstName: string; lastName: string; role: string; staffNumber: string; phone: string; email: string }

const P = '/payroll'
const data = <T>(p: Promise<{ data: { data: T } }>) => p.then((r) => r.data.data)

export const getPayrollSettings = () => data<PayrollSettings>(api.get(`${P}/settings`))
export const savePayrollSettings = (s: PayrollSettings) => data<PayrollSettings>(api.put(`${P}/settings`, s))
export const getPayPeople = () => data<PayPerson[]>(api.get(`${P}/people`))
export const savePayPerson = (key: string, p: { basic: number; allowances: PayItem[]; deductions: PayItem[]; bankName: string; accountNumber: string; accountName: string }) =>
  data<PayPerson>(api.put(`${P}/people/${key}`, p))
export const getRuns = () => data<RunSummary[]>(api.get(`${P}/runs`))
export const createRun = (month: string) => data<Run>(api.post(`${P}/runs`, { month }))
export const getRun = (month: string) => data<Run>(api.get(`${P}/runs/${month}`))
export const rebuildRun = (month: string) => data<Run>(api.post(`${P}/runs/${month}/rebuild`))
export const editLine = (month: string, key: string, changes: Partial<Pick<PayLine, 'extraPay' | 'extraDeductions' | 'waiveLateness' | 'excluded'>>) =>
  data<Run>(api.patch(`${P}/runs/${month}/lines/${key}`, changes))
export const approveRun = (month: string) => data<Run>(api.post(`${P}/runs/${month}/approve`))
export const reopenRun = (month: string) => data<Run>(api.post(`${P}/runs/${month}/reopen`))
export const deleteRun = (month: string) => data<{ month: string }>(api.delete(`${P}/runs/${month}`))
export const markPaid = (month: string, p: { keys?: string[]; paidOn: string; method: PayMethod; reference?: string }) => data<Run>(api.post(`${P}/runs/${month}/pay`, p))
export const unpay = (month: string, key: string) => data<Run>(api.post(`${P}/runs/${month}/lines/${key}/unpay`))
export const emailPayslips = (month: string, keys?: string[]) => data<{ sent: number; noEmail: string[]; failed: string[] }>(api.post(`${P}/runs/${month}/email`, { keys }))
export const getMyPayslips = () => data<{ school: PayrollSchool; payslips: { month: string; label: string; line: PayLine }[] }>(api.get(`${P}/my-payslips`))
export const getOtherStaff = () => data<OtherStaff[]>(api.get(`${P}/other-staff`))
export const saveOtherStaff = (id: string | null, s: Omit<OtherStaff, 'id' | 'key'>) => data<OtherStaff>(id ? api.put(`${P}/other-staff/${id}`, s) : api.post(`${P}/other-staff`, s))
export const removeOtherStaff = (id: string) => data<{ id: string }>(api.delete(`${P}/other-staff/${id}`))

/** ₦150,000 or ₦150,000.50 */
export const money = (n: number) => `₦${n.toLocaleString('en-NG', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`
export const total = (items: PayItem[]) => items.reduce((a, i) => a + i.amount, 0)

export const lagosMonth = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' }).slice(0, 7)
export const monthLabel = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
export const shiftMonth = (m: string, by: number) => {
  const [y, mo] = m.split('-').map(Number)
  const d = new Date(Date.UTC(y, mo - 1 + by, 15))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
