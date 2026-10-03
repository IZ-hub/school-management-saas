import { api } from './api'

export interface CardSubject {
  examId: string
  subject: string
  caMax: number
  examMax: number
  ca: number | null
  exam: number | null
  total: number | null
  grade: string | null
  position: number | null
  classAverage: number | null
  highest: number | null
  lowest: number | null
}

export interface ReportCard {
  student: { id: string; firstName: string; lastName: string; admissionNumber: string }
  subjects: CardSubject[]
  subjectsScored: number
  subjectsTotal: number
  total: number
  average: number | null
  grade: string | null
  position: number | null
  attendance: { present: number; absent: number; late: number; excused: number; daysMarked: number; daysPresent: number }
  teacherRemark: string
  principalRemark: string
}

export interface ClassReport {
  school: { name: string; address: string; phone: string; email: string; logo: string | null }
  series: { id: string; name: string; term: 'FIRST' | 'SECOND' | 'THIRD'; session: string; startDate: string; endDate: string }
  class: { id: string; name: string; formTeacher: string | null }
  attendancePeriod: { from: string; to: string }
  classSize: number
  ranked: number
  classAverage: number | null
  cards: ReportCard[]
}

export async function getClassReport(seriesId: string, classId: string): Promise<ClassReport> {
  return (await api.get('/report-cards', { params: { seriesId, classId } })).data.data
}

export async function saveRemarks(body: { seriesId: string; studentId: string; teacherRemark?: string; principalRemark?: string }) {
  return (await api.put('/report-cards/remarks', body)).data.data as { teacherRemark: string; principalRemark: string }
}

export const ordinal = (n: number) => {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${s}`
}

/** Remark ideas matched to the student's average, for one-tap use. */
export function suggestRemarks(average: number | null): string[] {
  if (average === null) return []
  if (average >= 70) return ['An excellent result. Keep it up!', 'Outstanding performance this term.']
  if (average >= 60) return ['A very good result. Keep working hard.', 'Very good effort this term.']
  if (average >= 50) return ['A good result, with room to improve.', 'Good effort. Aim higher next term.']
  if (average >= 45) return ['A fair result. More effort is needed.', 'Fair performance. Can do better with more focus.']
  if (average >= 40) return ['A weak result. Needs to work much harder.', 'Below expectations. More study is needed.']
  return ['A poor result. Needs serious improvement and support.', 'Needs close attention and extra help next term.']
}
