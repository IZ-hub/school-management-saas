import { Badge } from '../components/Badge'
import { DataTable, type Column } from '../components/DataTable'
import { PageHeader, PrimaryButton } from '../components/PageHeader'
import { attendance, type AttendanceRecord } from '../data/mock'

const columns: Column<AttendanceRecord>[] = [
  { key: 'student', header: 'Student', primary: true, render: (row) => row.student },
  { key: 'grade', header: 'Class', render: (row) => row.grade },
  { key: 'date', header: 'Date', render: (row) => row.date },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={row.status === 'Present' ? 'green' : row.status === 'Late' ? 'amber' : 'red'}>{row.status}</Badge>,
  },
]

export function Attendance() {
  const present = attendance.filter((record) => record.status === 'Present').length

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Daily register for 25 September 2025"
        action={<PrimaryButton>Take register</PrimaryButton>}
      />

      <div className="mb-4 grid grid-cols-1 gap-3 xs:grid-cols-3">
        {[
          { label: 'Present', value: present },
          { label: 'Late', value: attendance.filter((record) => record.status === 'Late').length },
          { label: 'Absent', value: attendance.filter((record) => record.status === 'Absent').length },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 text-center shadow-sm">
            <p className="text-2xl font-semibold text-slate-900">{stat.value}</p>
            <p className="text-xs tracking-wide text-slate-500 uppercase">{stat.label}</p>
          </div>
        ))}
      </div>

      <DataTable columns={columns} rows={attendance} rowKey={(row) => row.id} />
    </>
  )
}
