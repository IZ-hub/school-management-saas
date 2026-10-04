import { api } from './api'
import type { Term } from './examsApi'
import type { Method, Statement } from './feesApi'

export interface StudentProfile {
  student: {
    id: string
    firstName: string
    lastName: string
    admissionNumber: string
    gender: string | null
    dateOfBirth: string | null
    address: string | null
    parentEmail: string | null
    parentPhone: string | null
    status: string
    leftReason: string | null
    leftSession: string | null
    enrolledAt: unknown
  }
  class: { id: string; name: string; formTeacher: string | null } | null
  term: { term: Term; session: string }
  classHistory: { toSession: string; from: string; to: string; at: unknown }[]
  attendance: { from: string; to: string; present: number; late: number; absent: number; excused: number; rate: number | null; notable: { date: string; status: 'ABSENT' | 'LATE' | 'EXCUSED' }[] } | null
  results: {
    seriesId: string
    name: string
    term: Term
    session: string
    classId: string | null
    published: boolean
    subjects: { subject: string; ca: number | null; exam: number | null; total: number | null; grade: string | null }[]
    average: number | null
    grade: string | null
    scored: number
  }[] | null
  fees: {
    current: Omit<Statement, 'school'>
    payments: { id: string; receiptNumber: string; amount: number; method: Method; paidOn: string; term: Term; session: string; voided: boolean }[]
    totalPaid: number
  } | null
  parents: { userId: string; firstName: string; lastName: string; email: string; phone: string | null; status: 'ACTIVE' | 'INVITED' | 'DISABLED'; lastLogin: number | null }[] | null
  messages: { id: string; text: string; createdAt: unknown; sms: string | null }[] | null
  can: { academic: boolean; finance: boolean; admin: boolean; messages: boolean }
}

export const getStudentProfile = async (id: string): Promise<StudentProfile> => (await api.get(`/students/${id}/profile`)).data.data
