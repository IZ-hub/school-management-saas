import type { Result } from '@shared-types/index'
import { api } from './api'

export interface ResultQueryParams {
  examId?: string
  studentId?: string
}

export interface ResultPayload {
  examId: string
  studentId: string
  score: number
  grade?: string
  remarks?: string
}

export async function listResults(params?: ResultQueryParams): Promise<Result[]> {
  const response = await api.get<{ data: Result[] }>('/results', { params })
  return response.data.data
}

export async function createResult(payload: ResultPayload): Promise<Result> {
  const response = await api.post<{ data: Result }>('/results', payload)
  return response.data.data
}

export async function updateResult(id: string, payload: Partial<ResultPayload>): Promise<Result> {
  const response = await api.patch<{ data: Result }>(`/results/${id}`, payload)
  return response.data.data
}

export async function deleteResult(id: string): Promise<{ message: string }> {
  const response = await api.delete<{ data: { message: string } }>(`/results/${id}`)
  return response.data.data
}
