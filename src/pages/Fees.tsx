import { Badge } from '../components/Badge'
import { DataTable, type Column } from '../components/DataTable'
import { PageHeader, PrimaryButton } from '../components/PageHeader'
import { formatCurrency, invoices, type Invoice } from '../data/mock'

const columns: Column<Invoice>[] = [
  { key: 'student', header: 'Student', primary: true, render: (row) => row.student },
  { key: 'id', header: 'Invoice', render: (row) => row.id },
  { key: 'term', header: 'Term', render: (row) => row.term },
  { key: 'amount', header: 'Amount', render: (row) => formatCurrency(row.amount) },
  { key: 'due', header: 'Due', render: (row) => row.due },
  {
    key: 'status',
    header: 'Status',
    render: (row) => <Badge tone={row.status === 'Paid' ? 'green' : row.status === 'Pending' ? 'amber' : 'red'}>{row.status}</Badge>,
  },
]

export function Fees() {
  const outstanding = invoices.filter((invoice) => invoice.status !== 'Paid').reduce((total, invoice) => total + invoice.amount, 0)

  return (
    <>
      <PageHeader
        title="Fees"
        description={`${formatCurrency(outstanding)} outstanding across ${invoices.length} invoices`}
        action={<PrimaryButton>Record payment</PrimaryButton>}
      />
      <DataTable columns={columns} rows={invoices} rowKey={(row) => row.id} />
    </>
  )
}
