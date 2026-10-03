import { api } from './api'

export type Audience = 'ALL' | 'CLASSES' | 'OWING' | 'ABSENT_TODAY'
export const AUDIENCE_LABEL: Record<Audience, string> = {
  ALL: 'All parents',
  CLASSES: 'Parents in chosen classes',
  OWING: 'Parents who owe fees this term',
  ABSENT_TODAY: 'Parents of students absent today',
}

export interface Compose { audience: Audience; classIds?: string[]; text: string; sms: boolean }
export interface Preview {
  students: number
  onParentPage: number
  withPhone: number
  withoutPhone: number
  pages: number
  smsTotal: number
  smsAvailable: boolean
  sample: string
  tooMany: boolean
}
export interface SentMessage {
  id: string
  text: string
  audience: Audience
  classIds: string[]
  sms: boolean
  byName: string
  createdAt: unknown
  counts: { students: number; onParentPage: number; sms: { sent: number; failed: number; skipped: number } }
}
export interface SmsSettings { enabled: boolean; needsNewKey: boolean; senderId: string | null; keyHint: string | null; balance: number | null }

export const previewMessage = async (body: Compose): Promise<Preview> => (await api.post('/messages/preview', body)).data.data
export const sendMessage = async (body: Compose): Promise<{ id: string; counts: SentMessage['counts'] }> => (await api.post('/messages', body)).data.data
export const listMessages = async (): Promise<SentMessage[]> => (await api.get('/messages')).data.data
export const messageProblems = async (id: string): Promise<{ studentName: string; className: string; phone: string | null; status: string; error: string | null }[]> =>
  (await api.get(`/messages/${id}/problems`)).data.data
export const getSmsSettings = async (): Promise<SmsSettings> => (await api.get('/messages/sms-settings')).data.data
export const saveSmsSettings = async (apiKey: string, senderId: string): Promise<SmsSettings> => (await api.put('/messages/sms-settings', { apiKey, senderId })).data.data
export const removeSmsSettings = async (): Promise<SmsSettings> => (await api.delete('/messages/sms-settings')).data.data
export const parentInbox = async (): Promise<{ id: string; studentId: string; studentName: string; text: string; createdAt: unknown }[]> =>
  (await api.get('/parent/messages')).data.data

export const TEMPLATES: { label: string; audience: Audience; text: string }[] = [
  { label: 'Fee reminder', audience: 'OWING', text: 'Dear {parent}, this is a reminder that {student} has a fee balance of {balance} for this term. You can pay online from your parent page. Thank you. {school}' },
  { label: 'Absent today', audience: 'ABSENT_TODAY', text: 'Dear {parent}, {student} was marked absent from school today. Please let us know if all is well. {school}' },
  { label: 'Resumption', audience: 'ALL', text: 'Dear {parent}, school resumes on Monday. We look forward to seeing {student}. {school}' },
  { label: 'Results ready', audience: 'ALL', text: "Dear {parent}, {student}'s report card is now available on your parent page. {school}" },
]
