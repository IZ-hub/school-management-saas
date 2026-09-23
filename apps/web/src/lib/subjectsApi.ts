import type { Subject } from '@shared-types/index'
import { api } from './api'

export interface SubjectQueryParams {
  name?: string
  teacherId?: string
  status?: string
}

export interface SubjectPayload {
  name: string
  code: string
  teacherId?: string
}

export async function listSubjects(params?: SubjectQueryParams): Promise<Subject[]> {
  const response = await api.get<{ data: Subject[] }>('/subjects', { params })
  return response.data.data
}

export async function createSubject(payload: SubjectPayload): Promise<Subject> {
  const response = await api.post<{ data: Subject }>('/subjects', payload)
  return response.data.data
}

export async function updateSubject(id: string, payload: Partial<SubjectPayload>): Promise<Subject> {
  const response = await api.patch<{ data: Subject }>(`/subjects/${id}`, payload)
  return response.data.data
}

export async function deleteSubject(id: string): Promise<{ message: string }> {
  const response = await api.delete<{ data: { message: string } }>(`/subjects/${id}`)
  return response.data.data
}
