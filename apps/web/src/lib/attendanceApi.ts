import { api } from './api'

export const STATUSES = ['PRESENT', 'ABSENT', 'LATE', 'EXCUSED'] as const
export type AttendanceStatus = (typeof STATUSES)[number]
export type StatusCounts = Record<AttendanceStatus, number>

export interface RegisterStudent {
  id: string
  firstName: string
  lastName: string
  admissionNumber: string
  status: AttendanceStatus | null
}

export interface Register {
  classId: string
  className: string
  date: string
  takenAt: unknown
  takenByName: string | null
  students: RegisterStudent[]
}

export interface TodayClass {
  id: string
  name: string
  taken: boolean
  takenAt: unknown
  takenByName: string | null
  counts: StatusCounts
  rate: number | null
}

export interface TodayOverview {
  date: string
  classesTaken: number
  classesTotal: number
  counts: StatusCounts
  rate: number | null
  classes: TodayClass[]
}

export async function getToday(date?: string): Promise<TodayOverview> {
  const res = await api.get('/attendance/today', { params: date ? { date } : undefined })
  return res.data.data
}

export async function getRegister(classId: string, date: string): Promise<Register> {
  const res = await api.get('/attendance/register', { params: { classId, date } })
  return res.data.data
}

export async function saveRegister(
  classId: string,
  date: string,
  marks: { studentId: string; status: AttendanceStatus }[],
): Promise<Register> {
  const res = await api.put('/attendance/register', { classId, date, marks })
  return res.data.data
}

/** Firestore timestamps arrive as { _seconds }, the local API sends ISO strings. */
export function toDate(value: unknown): Date | null {
  if (!value) return null
  if (typeof value === 'object' && value !== null && '_seconds' in value) return new Date(Number((value as { _seconds: number })._seconds) * 1000)
  const d = new Date(value as string)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Today at the school (Lagos time), as YYYY-MM-DD. */
export function schoolToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Lagos', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}
