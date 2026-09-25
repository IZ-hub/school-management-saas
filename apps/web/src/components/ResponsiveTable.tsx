import { ReactNode } from 'react'
import { Table, TableContainer } from '@mui/material'

interface ResponsiveTableProps {
  children: ReactNode
  /** Width below which the table scrolls horizontally inside its container. */
  minWidth?: number
}

/**
 * Keeps wide tables inside their card: the table scrolls horizontally on small
 * screens instead of stretching the page and breaking the layout.
 */
export default function ResponsiveTable({ children, minWidth = 720 }: ResponsiveTableProps) {
  return (
    <TableContainer sx={{ maxWidth: '100%' }}>
      <Table sx={{ minWidth }}>{children}</Table>
    </TableContainer>
  )
}
