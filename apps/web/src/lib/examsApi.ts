import type { Exam } from '@shared-types/index'
import { api } from './api'

export interface ExamQueryParams {
  classId?: string
  subjectId?: string
  title?: string
}

export interface ExamPayload {
  classId: string
  subjectId: string
  date: string
  title: string
  description?: string
}

export async function listExams(params?: ExamQueryParams): Promise<Exam[]> {
  const response = await api.get<{ data: Exam[] }>('/exams', { params })
  return response.data.data
}

export async function createExam(payload: ExamPayload): Promise<Exam> {
  const response = await api.post<{ data: Exam }>('/exams', payload)
  return response.data.data
}

export async function updateExam(id: string, payload: Partial<ExamPayload>): Promise<Exam> {
  const response = await api.patch<{ data: Exam }>(`/exams/${id}`, payload)
  return response.data.data
}

export async function deleteExam(id: string): Promise<{ message: string }> {
  const response = await api.delete<{ data: { message: string } }>(`/exams/${id}`)
  return response.data.data
}
