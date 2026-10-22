import { api } from './api'
import { toDate } from './attendanceApi'

export type ScanMode = 'AUTO' | 'IN' | 'OUT'
export type ScanAction = 'IN' | 'OUT' | 'ALREADY_IN' | 'ALREADY_OUT'

export interface ScanResult {
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
  recent: { action: 'IN' | 'OUT'; time: string; studentId: string; name: string; className: string }[]
}

export interface IdCard { studentId: string; firstName: string; lastName: string; admissionNumber: string; className: string; qr: string; photo: string | null }
export interface CardSheet { school: { name: string; logo: string | null; motto: string; phone: string }; cards: IdCard[] }

export const scanCard = async (code: string, mode: ScanMode): Promise<ScanResult> => (await api.post('/gate/scan', { code, mode })).data.data
export const getGateToday = async (): Promise<GateToday> => (await api.get('/gate/today')).data.data
export const getGateSettings = async (): Promise<{ lateAfter: string | null }> => (await api.get('/gate/settings')).data.data
export const saveGateSettings = async (lateAfter: string | null): Promise<{ lateAfter: string | null }> => (await api.put('/gate/settings', { lateAfter })).data.data
export const getCards = async (classId?: string): Promise<CardSheet> => (await api.get('/gate/cards', { params: classId ? { classId } : {} })).data.data
export const reissueCard = async (studentId: string): Promise<{ studentId: string; qr: string }> => (await api.post(`/gate/cards/${studentId}/reissue`)).data.data

/** A stored clock time shown as 07:40 in school time. */
export const clockTime = (v: unknown) => {
  const d = toDate(v)
  return d ? d.toLocaleTimeString('en-GB', { timeZone: 'Africa/Lagos', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) : null
}
