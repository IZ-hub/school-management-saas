export type Student = {
  id: string
  name: string
  grade: string
  guardian: string
  phone: string
  attendance: number
  status: 'Active' | 'Suspended' | 'Graduated'
}

export type Teacher = {
  id: string
  name: string
  subject: string
  email: string
  classes: number
  status: 'Full time' | 'Part time'
}

export type SchoolClass = {
  id: string
  name: string
  teacher: string
  room: string
  students: number
  schedule: string
}

export type AttendanceRecord = {
  id: string
  student: string
  grade: string
  date: string
  status: 'Present' | 'Absent' | 'Late'
}

export type Invoice = {
  id: string
  student: string
  term: string
  amount: number
  due: string
  status: 'Paid' | 'Pending' | 'Overdue'
}

export const students: Student[] = [
  { id: 'STU-1001', name: 'Amara Okafor', grade: 'Grade 9A', guardian: 'Chidi Okafor', phone: '+234 802 111 0011', attendance: 96, status: 'Active' },
  { id: 'STU-1002', name: 'Bilal Hassan', grade: 'Grade 9A', guardian: 'Fatima Hassan', phone: '+234 803 221 0092', attendance: 88, status: 'Active' },
  { id: 'STU-1003', name: 'Chloe Mensah', grade: 'Grade 10B', guardian: 'Kwesi Mensah', phone: '+233 244 887 021', attendance: 74, status: 'Active' },
  { id: 'STU-1004', name: 'Daniel Adeyemi', grade: 'Grade 11C', guardian: 'Ngozi Adeyemi', phone: '+234 805 440 7781', attendance: 91, status: 'Suspended' },
  { id: 'STU-1005', name: 'Esther Njeri', grade: 'Grade 10B', guardian: 'Peter Njeri', phone: '+254 722 330 118', attendance: 99, status: 'Active' },
  { id: 'STU-1006', name: 'Farouk Diallo', grade: 'Grade 12A', guardian: 'Aissatou Diallo', phone: '+221 77 661 4420', attendance: 82, status: 'Graduated' },
  { id: 'STU-1007', name: 'Grace Mutanga', grade: 'Grade 11C', guardian: 'Joseph Mutanga', phone: '+260 977 220 431', attendance: 68, status: 'Active' },
  { id: 'STU-1008', name: 'Hamza Bello', grade: 'Grade 12A', guardian: 'Zainab Bello', phone: '+234 809 552 3310', attendance: 94, status: 'Active' },
]

export const teachers: Teacher[] = [
  { id: 'TCH-201', name: 'Mrs. Adaeze Nwosu', subject: 'Mathematics', email: 'a.nwosu@school.edu', classes: 5, status: 'Full time' },
  { id: 'TCH-202', name: 'Mr. Samuel Kimani', subject: 'Physics', email: 's.kimani@school.edu', classes: 4, status: 'Full time' },
  { id: 'TCH-203', name: 'Ms. Rita Owusu', subject: 'English Literature', email: 'r.owusu@school.edu', classes: 6, status: 'Part time' },
  { id: 'TCH-204', name: 'Mr. Tunde Balogun', subject: 'Chemistry', email: 't.balogun@school.edu', classes: 3, status: 'Full time' },
  { id: 'TCH-205', name: 'Mrs. Halima Yusuf', subject: 'Biology', email: 'h.yusuf@school.edu', classes: 4, status: 'Part time' },
]

export const classes: SchoolClass[] = [
  { id: 'CLS-9A', name: 'Grade 9A', teacher: 'Mrs. Adaeze Nwosu', room: 'Block A · 12', students: 32, schedule: 'Mon–Fri · 08:00' },
  { id: 'CLS-10B', name: 'Grade 10B', teacher: 'Mr. Samuel Kimani', room: 'Block B · 04', students: 28, schedule: 'Mon–Fri · 08:45' },
  { id: 'CLS-11C', name: 'Grade 11C', teacher: 'Ms. Rita Owusu', room: 'Block C · 21', students: 30, schedule: 'Mon–Thu · 09:30' },
  { id: 'CLS-12A', name: 'Grade 12A', teacher: 'Mr. Tunde Balogun', room: 'Science Lab 2', students: 24, schedule: 'Mon–Fri · 10:15' },
]

export const attendance: AttendanceRecord[] = [
  { id: 'ATT-5001', student: 'Amara Okafor', grade: 'Grade 9A', date: '2025-09-25', status: 'Present' },
  { id: 'ATT-5002', student: 'Bilal Hassan', grade: 'Grade 9A', date: '2025-09-25', status: 'Late' },
  { id: 'ATT-5003', student: 'Chloe Mensah', grade: 'Grade 10B', date: '2025-09-25', status: 'Absent' },
  { id: 'ATT-5004', student: 'Esther Njeri', grade: 'Grade 10B', date: '2025-09-25', status: 'Present' },
  { id: 'ATT-5005', student: 'Grace Mutanga', grade: 'Grade 11C', date: '2025-09-25', status: 'Absent' },
  { id: 'ATT-5006', student: 'Hamza Bello', grade: 'Grade 12A', date: '2025-09-25', status: 'Present' },
]

export const invoices: Invoice[] = [
  { id: 'INV-3001', student: 'Amara Okafor', term: 'Term 1 2025/26', amount: 420000, due: '2025-10-01', status: 'Paid' },
  { id: 'INV-3002', student: 'Bilal Hassan', term: 'Term 1 2025/26', amount: 420000, due: '2025-10-01', status: 'Pending' },
  { id: 'INV-3003', student: 'Chloe Mensah', term: 'Term 1 2025/26', amount: 465000, due: '2025-09-15', status: 'Overdue' },
  { id: 'INV-3004', student: 'Daniel Adeyemi', term: 'Term 1 2025/26', amount: 510000, due: '2025-10-01', status: 'Pending' },
  { id: 'INV-3005', student: 'Esther Njeri', term: 'Term 1 2025/26', amount: 465000, due: '2025-10-01', status: 'Paid' },
]

export const enrolmentTrend = [
  { month: 'Apr', value: 612 },
  { month: 'May', value: 640 },
  { month: 'Jun', value: 655 },
  { month: 'Jul', value: 631 },
  { month: 'Aug', value: 702 },
  { month: 'Sep', value: 748 },
]

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(value)
