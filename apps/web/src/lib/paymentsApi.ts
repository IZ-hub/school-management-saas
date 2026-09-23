import type { Payment } from '@shared-types/index'
import { api } from './api'

export interface PaymentQueryParams {
  feeId?: string
  studentId?: string
  method?: string
}

export interface PaymentPayload {
  feeId: string
  studentId: string
  amountPaid: number
  method: 'CASH' | 'CARD' | 'TRANSFER'
  reference?: string
}

export async function listPayments(params?: PaymentQueryParams): Promise<Payment[]> {
  const response = await api.get<{ data: Payment[] }>('/payments', { params })
  return response.data.data
}

export async function createPayment(payload: PaymentPayload): Promise<Payment> {
  const response = await api.post<{ data: Payment }>('/payments', payload)
  return response.data.data
}

export async function updatePayment(
  id: string,
  payload: Partial<PaymentPayload>,
): Promise<Payment> {
  const response = await api.patch<{ data: Payment }>(`/payments/${id}`, payload)
  return response.data.data
}

export async function deletePayment(id: string): Promise<{ message: string }> {
  const response = await api.delete<{ data: { message: string } }>(`/payments/${id}`)
  return response.data.data
}
