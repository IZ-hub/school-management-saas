import { Badge } from '../components/Badge'
import { DataTable, type Column } from '../components/DataTable'
import { PageHeader, PrimaryButton } from '../components/PageHeader'
import { attendance, enrolmentTrend, formatCurrency, invoices, type Invoice } from '../data/mock'

const stats = [
  { label: 'Students', value: '748', delta: '+6.5% vs last term' },
  { label: 'Teachers', value: '52', delta: '3 new this term' },
  { label: 'Attendance today', value: '92%', delta: '+2.1% vs yesterday' },
  { label: 'Fees collected', value: formatCurrency(18_420_000), delta: '78% of target' },
]

const invoiceColumns: Column<Invoice>[] = [
  { key: 'student', header: 'Student', primary: true, render: (row) => row.student },
  { key: 'term', header: 'Term', render: (row) => row.term },
  { key: 'amount', header: 'Amount', render: (row) => formatCurrency(row.amount) },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={row.status === 'Paid' ? 'green' : row.status === 'Pending' ? 'amber' : 'red'}>{row.status}</Badge>,
  },
]

export function Dashboard() {
  const peak = Math.max(...enrolmentTrend.map((point) => point.value))

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Term 1 · 2025/26 session overview"
        action={<PrimaryButton>New announcement</PrimaryButton>}
      />

      <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{stat.label}</p>
            <p className="mt-2 text-xl font-semibold break-words text-slate-900 sm:text-2xl">{stat.value}</p>
            <p className="mt-1 text-xs text-slate-500">{stat.delta}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:mt-6 lg:grid-cols-3">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm lg:col-span-2">
          <h2 className="text-sm font-semibold text-slate-900">Enrolment trend</h2>
          <div className="mt-4 flex h-40 items-end gap-2 sm:h-52 sm:gap-4">
            {enrolmentTrend.map((point) => (
              <div key={point.month} className="flex min-w-0 flex-1 flex-col items-center gap-2">
                <div
                  className="w-full rounded-t-md bg-sky-500/80"
                  style={{ height: `${(point.value / peak) * 100}%` }}
                  role="presentation"
                />
                <span className="text-[11px] text-slate-500 sm:text-xs">{point.month}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Today&apos;s attendance flags</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {attendance
              .filter((record) => record.status !== 'Present')
              .map((record) => (
                <li key={record.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{record.student}</p>
                    <p className="text-xs text-slate-500">{record.grade}</p>
                  </div>
                  <Badge tone={record.status === 'Absent' ? 'red' : 'amber'}>{record.status}</Badge>
                </li>
              ))}
          </ul>
        </section>
      </div>

      <section className="mt-4 sm:mt-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent invoices</h2>
        <DataTable columns={invoiceColumns} rows={invoices.slice(0, 4)} rowKey={(row) => row.id} />
      </section>
    </>
  )
}
