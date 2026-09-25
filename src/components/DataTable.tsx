import type { ReactNode } from 'react'

export type Column<T> = {
  key: string
  header: string
  render: (row: T) => ReactNode
  /** Hidden in the mobile card layout when true (used for the primary/title field). */
  primary?: boolean
}

type DataTableProps<T> = {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  empty?: string
}

/**
 * Renders a real table from `md` up and a stacked card list below it, so rows stay
 * readable on narrow screens without horizontal scrolling.
 */
export function DataTable<T>({ columns, rows, rowKey, empty = 'Nothing to show yet.' }: DataTableProps<T>) {
  if (rows.length === 0) {
    return <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">{empty}</p>
  }

  const primary = columns.find((column) => column.primary) ?? columns[0]
  const secondary = columns.filter((column) => column !== primary)

  return (
    <>
      <ul className="grid gap-3 md:hidden">
        {rows.map((row) => (
          <li key={rowKey(row)} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="text-base font-semibold text-slate-900 break-words">{primary.render(row)}</div>
            <dl className="mt-3 grid grid-cols-1 gap-2 xs:grid-cols-2">
              {secondary.map((column) => (
                <div key={column.key} className="flex items-start justify-between gap-3">
                  <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">{column.header}</dt>
                  <dd className="text-sm text-slate-800 text-right break-words">{column.render(row)}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              {columns.map((column) => (
                <th key={column.key} scope="col" className="px-4 py-3 font-medium whitespace-nowrap">
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="hover:bg-slate-50">
                {columns.map((column) => (
                  <td key={column.key} className="px-4 py-3 align-middle text-slate-700">
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
