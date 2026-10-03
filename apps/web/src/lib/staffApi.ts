import { api } from './api'

export const STAFF_ROLE_OPTIONS = ['TEACHER', 'ACCOUNTANT', 'VICE_PRINCIPAL', 'PRINCIPAL'] as const
export type StaffRole = (typeof STAFF_ROLE_OPTIONS)[number]

export interface StaffMember {
  userId: string
  firstName: string
  lastName: string
  email: string
  role: string
  status: 'ACTIVE' | 'INVITED' | 'DISABLED'
  lastLogin: number | null
  teacherId: string | null
  teacherName: string | null
  inviteExpiresAt: number | null
}

export interface StaffInvite { userId: string; email: string; code: string; expiresAt: string }

export const listStaff = async (): Promise<StaffMember[]> => (await api.get('/staff')).data.data
export const inviteStaff = async (body: { email: string; firstName: string; lastName: string; role: StaffRole; teacherId?: string }): Promise<StaffInvite> =>
  (await api.post('/staff/invite', body)).data.data
export const resendStaffInvite = async (id: string): Promise<StaffInvite> => (await api.post(`/staff/${id}/resend`)).data.data
export const changeStaffRole = async (id: string, role: StaffRole) => (await api.patch(`/staff/${id}/role`, { role })).data.data
export const setStaffEnabled = async (id: string, enabled: boolean) => (await api.post(`/staff/${id}/${enabled ? 'enable' : 'disable'}`)).data.data

export const staffSetupLink = (code: string) => `${window.location.origin}/setup#${code}`
