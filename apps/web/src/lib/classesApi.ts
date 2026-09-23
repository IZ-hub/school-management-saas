import type { Class } from '@shared-types/index'
import { api } from './api'

export interface ClassQueryParams {
  name?: string
  gradeLevel?: string
  teacherId?: string
  status?: string
}

export interface ClassPayload {
  name: string
  gradeLevel: string
  teacherId?: string
  capacity?: number
}

export async function listClasses(params?: ClassQueryParams): Promise<Class[]> {
  const response = await api.get<{ data: Class[] }>('/classes', { params })
  return response.data.data
}

export async function createClass(payload: ClassPayload): Promise<Class> {
  const response = await api.post<{ data: Class }>('/classes', payload)
  return response.data.data
}

export async function updateClass(id: string, payload: Partial<ClassPayload>): Promise<Class> {
  const response = await api.patch<{ data: Class }>(`/classes/${id}`, payload)
  return response.data.data
}

export async function deleteClass(id: string): Promise<{ message: string }> {
  const response = await api.delete<{ data: { message: string } }>(`/classes/${id}`)
  return response.data.data
}
