// Shared TypeScript types
export interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: string
  schoolId: string
}

export interface School {
  id: string
  name: string
  slug: string
  status: string
}

export interface Student {
  id: string
  admissionNumber: string
  firstName: string
  lastName: string
  classId?: string
}

export interface Teacher {
  id: string
  employeeNumber: string
  firstName: string
  lastName: string
  department?: string
}

export interface Class {
  id: string
  schoolId: string
  name: string
  gradeLevel: string
  teacherId: string | null
  studentIds: string[]
  capacity: number | null
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: number
  updatedAt: number
}

export interface Subject {
  id: string
  schoolId: string
  name: string
  code: string
  teacherId: string | null
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: number
  updatedAt: number
}

export interface Attendance {
  id: string
  schoolId: string
  studentId: string
  classId: string
  subjectId: string
  date: string
  status: 'PRESENT' | 'ABSENT' | 'LATE'
  recordedBy: string
  createdAt: number
  updatedAt: number
}

export interface Exam {
  id: string
  schoolId: string
  classId: string
  subjectId: string
  date: string
  title: string
  description: string | null
  createdAt: number
  updatedAt: number
}

export interface Result {
  id: string
  schoolId: string
  examId: string
  studentId: string
  score: number
  grade: string | null
  remarks: string | null
  createdAt: number
  updatedAt: number
}

export interface Fee {
  id: string
  schoolId: string
  studentId: string
  classId: string
  term: string
  amount: number
  dueDate: string
  status: 'PENDING' | 'PAID' | 'OVERDUE'
  createdAt: number
  updatedAt: number
}

export interface Payment {
  id: string
  schoolId: string
  feeId: string
  studentId: string
  amountPaid: number
  method: 'CASH' | 'CARD' | 'TRANSFER'
  reference: string | null
  createdAt: number
  updatedAt: number
}
