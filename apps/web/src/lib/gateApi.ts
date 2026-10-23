import { api } from './api'
import { toDate } from './attendanceApi'

export type ScanMode = 'AUTO' | 'IN' | 'OUT'
export type ScanAction = 'IN' | 'OUT' | 'ALREADY_IN' | 'ALREADY_OUT'

export interface ScanResult {
  /** A staff scan fills `student` with the role (as className) and staff number (as admissionNumber). */
  who: 'STUDENT' | 'STAFF'
  action: ScanAction
  student: { id: string; name: string; admissionNumber: string; className: string; photo: string | null }
  time: string
  clockIn: string | null
  clockOut: string | null
  late: boolean
  marked: string | null
}

export interface GateToday {
  date: string
  clockedIn: number
  clockedOut: number
  stillIn: number
  staff: { clockedIn: number; stillIn: number; late: number }
  recent: { who: 'STUDENT' | 'STAFF'; action: 'IN' | 'OUT'; time: string; studentId: string; name: string; className: string }[]
}

export interface IdCard { studentId: string; firstName: string; lastName: string; admissionNumber: string; className: string; qr: string; photo: string | null }
export interface CardSheet { school: { name: string; logo: string | null; motto: string; phone: string }; cards: IdCard[] }

export const scanCard = async (code: string, mode: ScanMode): Promise<ScanResult> => (await api.post('/gate/scan', { code, mode })).data.data
export const getGateToday = async (): Promise<GateToday> => (await api.get('/gate/today')).data.data
export interface GateSettings { lateAfter: string | null; staffLateAfter: string | null }
export const getGateSettings = async (): Promise<GateSettings> => (await api.get('/gate/settings')).data.data
export const saveGateSettings = async (s: Partial<GateSettings>): Promise<GateSettings> => (await api.put('/gate/settings', s)).data.data
export const getCards = async (classId?: string): Promise<CardSheet> => (await api.get('/gate/cards', { params: classId ? { classId } : {} })).data.data
export const reissueCard = async (studentId: string): Promise<{ studentId: string; qr: string }> => (await api.post(`/gate/cards/${studentId}/reissue`)).data.data

/** A stored clock time shown as 07:40 in school time. */
export const clockTime = (v: unknown) => {
  const d = toDate(v)
  return d ? d.toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : null
}

/** A staff member: a teacher record (key T_…) or a staff account that isn't a teacher's (key U_…). */
export interface StaffMember { key: string; firstName: string; lastName: string; role: string; number: string }
export interface StaffCard extends StaffMember { qr: string }
export interface StaffDay {
  date: string
  total: number
  arrived: number
  late: number
  notIn: number
  staff: (StaffMember & { clockIn: string | null; clockOut: string | null; late: boolean })[]
}
export const getStaffCards = async (): Promise<{ school: CardSheet['school']; cards: StaffCard[] }> => (await api.get('/gate/staff-cards')).data.data
export const reissueStaffCard = async (key: string): Promise<{ key: string; qr: string }> => (await api.post(`/gate/staff-cards/${key}/reissue`)).data.data
export const getStaffDay = async (date?: string): Promise<StaffDay> => (await api.get('/gate/staff-attendance', { params: date ? { date } : {} })).data.data
