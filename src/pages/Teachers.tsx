import { Badge } from '../components/Badge'
import { DataTable, type Column } from '../components/DataTable'
import { PageHeader, PrimaryButton } from '../components/PageHeader'
import { teachers, type Teacher } from '../data/mock'

const columns: Column<Teacher>[] = [
  { key: 'name', header: 'Teacher', primary: true, render: (row) => row.name },
  { key: 'subject', header: 'Subject', render: (row) => row.subject },
  { key: 'email', header: 'Email', render: (row) => <span className="break-all">{row.email}</span> },
  { key: 'classes', header: 'Classes', render: (row) => row.classes },
  { key: 'status', header: 'Contract', render: (row) => <Badge tone={row.status === 'Full time' ? 'green' : 'amber'}>{row.status}</Badge> },
]

export function Teachers() {
  return (
    <>
      <PageHeader title="Teachers" description={`${teachers.length} staff members`} action={<PrimaryButton>Invite teacher</PrimaryButton>} />
      <DataTable columns={columns} rows={teachers} rowKey={(row) => row.id} />
    </>
  )
}
