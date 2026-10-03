import { api } from './api'

export const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const
export type Day = (typeof DAYS)[number]
export const DAY_LABEL: Record<Day, string> = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday' }

export interface Period { id: string; label: string; start: string; end: string; kind: 'LESSON' | 'BREAK' }
export interface Setup { days: Day[]; periods: Period[] }
export interface Lesson {
  classId: string
  className: string
  day: Day
  periodId: string
  subjectId: string
  subject: string
  teacherId: string | null
  teacherName: string | null
  clash: boolean
}
export interface Clash { teacherId: string; teacherName: string | null; day: Day; periodId: string; lessons: { classId: string; className: string; subject: string }[] }
export interface ClassWeek {
  setup: Setup
  class: { id: string; name: string }
  lessons: Lesson[]
  subjects: { subjectId: string; subject: string; teacherId: string | null; teacherName: string | null; periods: number }[]
  filled: number
  total: number
  clashes: Clash[]
}
export interface TeacherWeek { setup: Setup; teacher: { id: string; name: string }; lessons: Lesson[]; periodsPerWeek: number; clashes: Clash[] }

export const getOverview = async (): Promise<{ setup: Setup; classes: { classId: string; name: string; filled: number; total: number }[]; clashes: Clash[] }> =>
  (await api.get('/timetable/overview')).data.data
export const getClassWeek = async (id: string): Promise<ClassWeek> => (await api.get(`/timetable/class/${id}`)).data.data
export const getTeacherWeek = async (id: string): Promise<TeacherWeek> => (await api.get(`/timetable/teacher/${id}`)).data.data
export const getMyWeek = async (): Promise<TeacherWeek> => (await api.get('/timetable/mine')).data.data
export const setSlot = async (classId: string, day: Day, periodId: string, subjectId: string | null): Promise<{ clash: Clash | null }> =>
  (await api.put(`/timetable/class/${classId}/slot`, { day, periodId, subjectId })).data.data
export const saveSetup = async (setup: Setup): Promise<Setup> => (await api.put('/timetable/setup', setup)).data.data

/** "08:00" -> "8:00" */
export const shortTime = (t: string) => t.replace(/^0/, '')
