import type { Attendance } from '@shared-types/index'
import { api } from './api'

export interface AttendanceQueryParams {
  studentId?: string
  classId?: string
  subjectId?: string
  date?: string
  status?: string
}

export interface AttendancePayload {
  studentId: string
  classId: string
  subjectId: string
  date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE'
}

export async function listAttendance(params?: AttendanceQueryParams): Promise<Attendance[]> {
  const response = await api.get<{ data: Attendance[] }>('/attendance', { params })
  return response.data.data
}

export async function createAttendance(payload: AttendancePayload): Promise<Attendance> {
  const response = await api.post<{ data: Attendance }>('/attendance', payload)
  return response.data.data
}

export async function updateAttendance(
  id: string,
  payload: Partial<AttendancePayload>,
): Promise<Attendance> {
  const response = await api.patch<{ data: Attendance }>(`/attendance/${id}`, payload)
  return response.data.data
}

export async function deleteAttendance(id: string): Promise<{ message: string }> {
  const response = await api.delete<{ data: { message: string } }>(`/attendance/${id}`)
  return response.data.data
}
