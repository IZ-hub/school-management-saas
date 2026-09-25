import { useMemo, useState } from 'react'
import { Badge } from '../components/Badge'
import { DataTable, type Column } from '../components/DataTable'
import { PageHeader, PrimaryButton } from '../components/PageHeader'
import { students, type Student } from '../data/mock'

const columns: Column<Student>[] = [
  { key: 'name', header: 'Student', primary: true, render: (row) => row.name },
  { key: 'id', header: 'ID', render: (row) => row.id },
  { key: 'grade', header: 'Class', render: (row) => row.grade },
  { key: 'guardian', header: 'Guardian', render: (row) => row.guardian },
  { key: 'phone', header: 'Phone', render: (row) => row.phone },
  { key: 'attendance', header: 'Attendance', render: (row) => `${row.attendance}%` },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={row.status === 'Active' ? 'green' : row.status === 'Suspended' ? 'red' : 'blue'}>{row.status}</Badge>,
  },
]

const grades = ['All classes', ...Array.from(new Set(students.map((student) => student.grade)))]

export function Students() {
  const [query, setQuery] = useState('')
  const [grade, setGrade] = useState(grades[0])

  const rows = useMemo(
    () =>
      students.filter(
        (student) =>
          (grade === grades[0] || student.grade === grade) &&
          (student.name.toLowerCase().includes(query.toLowerCase()) || student.id.toLowerCase().includes(query.toLowerCase())),
      ),
    [query, grade],
  )

  return (
    <>
      <PageHeader title="Students" description={`${students.length} enrolled learners`} action={<PrimaryButton>Add student</PrimaryButton>} />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <label className="block">
          <span className="sr-only">Search students</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
            placeholder="Search by name or ID"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500"
          />
        </label>
        <label className="block">
          <span className="sr-only">Filter by class</span>
          <select
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-sky-500"
          >
            {grades.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} empty="No students match your filters." />
    </>
  )
}
