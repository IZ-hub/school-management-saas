import { api } from './api'

export const TERMS = ['FIRST', 'SECOND', 'THIRD'] as const
export type Term = (typeof TERMS)[number]
export const TERM_LABEL: Record<Term, string> = { FIRST: 'First Term', SECOND: 'Second Term', THIRD: 'Third Term' }

export type SeriesStatus = 'DRAFT' | 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED'

export interface ExamSeries {
  id: string
  name: string
  term: Term
  session: string
  startDate: string
  endDate: string
  classIds: string[]
  defaultMaxScore: number
  defaultDurationMinutes: number
  papers: number
  scheduled: number
  clashCount: number
  status: SeriesStatus
}

export interface ExamPaper {
  id: string
  seriesId: string
  classId: string
  subjectId: string
  title: string
  date: string | null
  startTime: string | null
  durationMinutes: number
  maxScore: number
  teacherId: string | null
}

export interface Clash {
  date: string
  reason: 'CLASS' | 'TEACHER'
  paperIds: [string, string]
}

export interface ExamSeriesDetail extends ExamSeries {
  paperList: ExamPaper[]
  clashes: Clash[]
}

export interface NewSeries {
  term: Term
  session: string
  name?: string
  startDate: string
  endDate: string
  classIds: string[]
  defaultMaxScore?: number
  defaultDurationMinutes?: number
}

export async function listSeries(): Promise<ExamSeries[]> {
  return (await api.get('/exam-series')).data.data
}

export async function getSeries(id: string): Promise<ExamSeriesDetail> {
  return (await api.get(`/exam-series/${id}`)).data.data
}

export async function createSeries(body: NewSeries): Promise<ExamSeries & { created: number; classesWithoutSubjects: string[] }> {
  return (await api.post('/exam-series', body)).data.data
}

export async function updateSeries(id: string, body: { name?: string; startDate?: string; endDate?: string }): Promise<ExamSeriesDetail> {
  return (await api.patch(`/exam-series/${id}`, body)).data.data
}

export async function addPapers(id: string, classIds: string[] = []): Promise<{ created: number; classesWithoutSubjects: string[] }> {
  return (await api.post(`/exam-series/${id}/papers`, { classIds })).data.data
}

export async function deleteSeries(id: string): Promise<void> {
  await api.delete(`/exam-series/${id}`)
}

export async function updatePaper(
  id: string,
  body: { date?: string | null; startTime?: string | null; durationMinutes?: number; maxScore?: number },
): Promise<ExamPaper> {
  return (await api.patch(`/exams/${id}`, body)).data.data
}

/** The current school session: a new one begins in September, e.g. 2026/2027. */
export function currentSession(today = new Date()): string {
  const y = today.getFullYear()
  return today.getMonth() >= 8 ? `${y}/${y + 1}` : `${y - 1}/${y}`
}

/** First Term from September, Second Term from January, Third Term from May. */
export function currentTerm(today = new Date()): Term {
  const m = today.getMonth()
  return m >= 8 ? 'FIRST' : m <= 3 ? 'SECOND' : 'THIRD'
}

export const daysBetween = (from: string, to: string) =>
  Math.round((new Date(`${to}T12:00:00`).getTime() - new Date(`${from}T12:00:00`).getTime()) / 86_400_000)

/** "Starts in 5 days", "Day 2 of 9", "Ended 3 days ago". */
export function countdown(s: { startDate: string; endDate: string }, today: string): string {
  const toStart = daysBetween(today, s.startDate)
  if (toStart > 0) return toStart === 1 ? 'Starts tomorrow' : `Starts in ${toStart} days`
  const sinceEnd = daysBetween(s.endDate, today)
  if (sinceEnd > 0) return sinceEnd === 1 ? 'Ended yesterday' : `Ended ${sinceEnd} days ago`
  return `Day ${daysBetween(s.startDate, today) + 1} of ${daysBetween(s.startDate, s.endDate) + 1}`
}

export const STATUS_STYLE: Record<SeriesStatus, { label: string; bg: string; fg: string }> = {
  DRAFT: { label: 'Draft', bg: '#efeee8', fg: '#4d534d' },
  SCHEDULED: { label: 'Scheduled', bg: '#e6ebf2', fg: '#36485e' },
  IN_PROGRESS: { label: 'In progress', bg: '#e3f1e6', fg: '#1d5f36' },
  COMPLETED: { label: 'Completed', bg: '#f1efe9', fg: '#646b64' },
}

export const formatDuration = (min: number) => {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
}

/** "09:00" -> "9:00 am" */
export const formatTime = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`
}

export const endTime = (start: string, minutes: number) => {
  const [h, m] = start.split(':').map(Number)
  const total = (h * 60 + m + minutes) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
