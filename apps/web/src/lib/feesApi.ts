import type { Fee } from '@shared-types/index'
import { api } from './api'

export interface FeeQueryParams {
  studentId?: string
  classId?: string
  term?: string
  status?: string
}

export interface FeePayload {
  studentId: string
  classId: string
  term: string
  amount: number
  dueDate: string
  status?: 'PENDING' | 'PAID' | 'OVERDUE'
}

export async function listFees(params?: FeeQueryParams): Promise<Fee[]> {
  const response = await api.get<{ data: Fee[] }>('/fees', { params })
  return response.data.data
}

export async function createFee(payload: FeePayload): Promise<Fee> {
  const response = await api.post<{ data: Fee }>('/fees', payload)
  return response.data.data
}

export async function updateFee(id: string, payload: Partial<FeePayload>): Promise<Fee> {
  const response = await api.patch<{ data: Fee }>(`/fees/${id}`, payload)
  return response.data.data
}

export async function deleteFee(id: string): Promise<{ message: string }> {
  const response = await api.delete<{ data: { message: string } }>(`/fees/${id}`)
  return response.data.data
}
