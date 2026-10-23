import { useEffect, useState } from 'react'
import { Alert, Box, Button, ButtonBase, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { ArrowBack as BackIcon, Print as PrintIcon } from '@mui/icons-material'
import { brand } from '../theme'
import Payslip, { PAYSLIP_PRINT_CSS } from '../components/Payslip'
import { PayLine, PayrollSchool, getMyPayslips, money } from '../lib/payrollApi'

type Slip = { month: string; label: string; line: PayLine }

/** A staff member's own payslips, from approved payrolls. */
export default function MyPayslips() {
  const [data, setData] = useState<{ school: PayrollSchool; payslips: Slip[] } | null>(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<Slip | null>(null)
  useEffect(() => { getMyPayslips().then(setData).catch((e) => setError(e?.response?.data?.message || "Couldn't load your payslips.")) }, [])

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 860, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <style>{PAYSLIP_PRINT_CSS}</style>
      {open && data ? (
        <>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Button startIcon={<BackIcon />} onClick={() => setOpen(null)} sx={{ ml: -1, color: brand.muted }}>My payslips</Button>
            <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()}>Print or save as PDF</Button>
          </Stack>
          <Box className="payslips" sx={{ overflowX: 'auto' }}>
            <Payslip school={data.school} label={open.label} line={open.line} />
          </Box>
        </>
      ) : (
        <>
          <Typography variant="h4">My payslips</Typography>
          <Typography sx={{ color: brand.muted, fontSize: '14.5px', mb: 2.5 }}>Your pay for each month once the school has approved it. Only you and the people who handle pay can see these.</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {!data && !error ? <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress size={28} /></Stack> : data && (
            <Paper>
              {data.payslips.length === 0 ? (
                <Typography sx={{ p: 3, color: brand.muted, textAlign: 'center' }}>No payslips yet. They appear here once a month's payroll is approved.</Typography>
              ) : data.payslips.map((p, i) => (
                <ButtonBase key={p.month} onClick={() => setOpen(p)} sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', px: 2.5, py: 1.5, textAlign: 'left', borderTop: i ? `1px solid ${brand.border}` : 'none', '&:hover': { bgcolor: '#f7f6f1' } }}>
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>{p.label}</Typography>
                    <Typography sx={{ fontSize: '12.5px', color: brand.muted }}>{p.line.paid ? 'Paid' : 'Approved, not yet paid'}</Typography>
                  </Box>
                  <Typography sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(p.line.net)}</Typography>
                </ButtonBase>
              ))}
            </Paper>
          )}
        </>
      )}
    </Box>
  )
}
