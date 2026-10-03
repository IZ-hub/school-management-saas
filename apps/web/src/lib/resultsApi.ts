import { api } from './api'

export interface SheetStudent {
  id: string
  firstName: string
  lastName: string
  admissionNumber: string
  ca: number | null
  exam: number | null
  total: number | null
  grade: string | null
}

export interface ScoreSheet {
  examId: string
  seriesId: string
  seriesName: string
  classId: string
  className: string
  subjectId: string
  subject: string
  caMax: number
  examMax: number
  canEdit: boolean
  updatedAt: unknown
  updatedByName: string | null
  students: SheetStudent[]
}

export interface PaperProgress {
  examId: string
  classId: string
  subjectId: string
  subject: string
  students: number
  complete: number
  started: number
  average: number | null
  mine: boolean
  canEdit: boolean
}

export async function getSheet(examId: string): Promise<ScoreSheet> {
  return (await api.get('/results/sheet', { params: { examId } })).data.data
}

export async function saveSheet(examId: string, scores: { studentId: string; ca: number | null; exam: number | null }[]): Promise<ScoreSheet & { changed: number }> {
  return (await api.put('/results/sheet', { examId, scores })).data.data
}

export async function getProgress(seriesId: string): Promise<PaperProgress[]> {
  return (await api.get('/results/progress', { params: { seriesId } })).data.data
}

export const GRADES = ['A', 'B', 'C', 'D', 'E', 'F'] as const

/** A 70–100, B 60–69, C 50–59, D 45–49, E 40–44, F below 40 (same as the server). */
export const gradeFor = (total: number) =>
  total >= 70 ? 'A' : total >= 60 ? 'B' : total >= 50 ? 'C' : total >= 45 ? 'D' : total >= 40 ? 'E' : 'F'

// Grade colours are always shown with the letter, never colour alone.
export const GRADE_STYLE: Record<string, { bg: string; fg: string }> = {
  A: { bg: '#e3f1e6', fg: '#1d5f36' },
  B: { bg: '#ebf3e1', fg: '#3d5f1d' },
  C: { bg: '#e6ebf2', fg: '#36485e' },
  D: { bg: '#fdf0d5', fg: '#7a4c00' },
  E: { bg: '#fbe9dc', fg: '#8a3f0f' },
  F: { bg: '#fbe4e2', fg: '#9b2a22' },
}
