import { api } from './api'
import type { Term } from './examsApi'
import type { Statement } from './feesApi'
import type { ClassReport, ReportCard } from './reportCardsApi'

export interface ParentChild { id: string; firstName: string; lastName: string; admissionNumber: string; className: string | null }

export interface ChildOverview {
  term: Term
  session: string
  attendance: {
    from: string
    to: string
    present: number
    late: number
    absent: number
    excused: number
    rate: number | null
    recent: { date: string; status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED' }[]
  }
  fees: Omit<Statement, 'school'>
  reportCards: { seriesId: string; name: string; publishedAt: unknown; startDate: string }[]
}

export interface LinkedParent {
  userId: string
  firstName: string
  lastName: string
  email: string
  phone: string | null
  status: 'ACTIVE' | 'INVITED' | 'DISABLED'
  inviteExpiresAt: number | null
  children: number
}

export type InviteResult = { status: 'LINKED'; userId: string; email: string } | { status: 'INVITED'; userId: string; email: string; code: string; expiresAt: string }

// Parent portal
export const getChildren = async (): Promise<{ schoolName: string; schoolLogo: string | null; children: ParentChild[] }> => (await api.get('/parent/children')).data.data
export const getChildOverview = async (id: string): Promise<ChildOverview> => (await api.get(`/parent/children/${id}`)).data.data
export const getChildReportCard = async (id: string, seriesId: string): Promise<Omit<ClassReport, 'cards'> & { card: ReportCard }> =>
  (await api.get(`/parent/children/${id}/report-card`, { params: { seriesId } })).data.data
export const getChildFees = async (id: string): Promise<Statement> => (await api.get(`/parent/children/${id}/fees`)).data.data

// Invites (public)
export const getInvite = async (code: string): Promise<{ email: string; firstName: string; role: string; schoolName: string; children: string[] }> =>
  (await api.get('/auth/invite', { params: { code } })).data.data
export const acceptInvite = async (code: string, password: string) => (await api.post('/auth/accept-invite', { code, password })).data.data

// School admins
export const listParents = async (studentId: string): Promise<LinkedParent[]> => (await api.get('/parent-access', { params: { studentId } })).data.data
export const inviteParent = async (body: { studentId: string; email: string; firstName: string; lastName: string; phone?: string }): Promise<InviteResult> =>
  (await api.post('/parent-access/invite', body)).data.data
export const resendInvite = async (userId: string): Promise<InviteResult> => (await api.post(`/parent-access/${userId}/resend`)).data.data
export const unlinkParent = async (userId: string, studentId: string) => (await api.delete(`/parent-access/${userId}/children/${studentId}`)).data.data

/** The setup link a school shares; the code sits after "#" so it never reaches server logs. */
export const setupLink = (code: string) => `${window.location.origin}/parent-setup#${code}`
