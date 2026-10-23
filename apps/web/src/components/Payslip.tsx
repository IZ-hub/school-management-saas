import { Box, Stack, Typography } from '@mui/material'
import { brand } from '../theme'
import { PAY_METHOD, PayLine, PayrollSchool, money } from '../lib/payrollApi'

const Row = ({ k, v, strong, minus }: { k: string; v: number; strong?: boolean; minus?: boolean }) => (
  <Stack direction="row" justifyContent="space-between" sx={{ py: '1.2mm', borderBottom: strong ? 'none' : '0.2mm solid #ece9e0' }}>
    <Typography sx={{ fontSize: '3.3mm', fontWeight: strong ? 800 : 400 }}>{k}</Typography>
    <Typography sx={{ fontSize: '3.3mm', fontWeight: strong ? 800 : 500, fontVariantNumeric: 'tabular-nums' }}>{minus && v ? `−${money(v)}` : money(v)}</Typography>
  </Stack>
)

/** One printable payslip (half an A4 page). */
export default function Payslip({ school, label, line }: { school: PayrollSchool; label: string; line: PayLine }) {
  const earnings: [string, number][] = [['Basic pay', line.basic], ...line.allowances.map((a) => [a.label, a.amount] as [string, number]), ...line.extraPay.map((a) => [a.label, a.amount] as [string, number])]
  const less: [string, number][] = [
    ...line.deductions.map((d) => [d.label, d.amount] as [string, number]),
    ...line.extraDeductions.map((d) => [d.label, d.amount] as [string, number]),
    ...(line.lateDeduction ? [[`Lateness (${line.lateDays} late ${line.lateDays === 1 ? 'day' : 'days'})`, line.lateDeduction] as [string, number]] : []),
  ]
  return (
    <Box className="payslip" sx={{ width: '180mm', minHeight: '128mm', boxSizing: 'border-box', p: '7mm', bgcolor: '#fff', border: '0.3mm solid #d9d6cc', borderRadius: '2mm', breakInside: 'avoid', color: '#0f2a24' }}>
      <Stack direction="row" spacing="3mm" alignItems="center" sx={{ pb: '3mm', mb: '3mm', borderBottom: `0.6mm solid ${brand.green}` }}>
        {school.logo && <Box component="img" src={school.logo} alt="" sx={{ width: '12mm', height: '12mm', objectFit: 'contain' }} />}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontSize: '4.6mm', fontWeight: 800, lineHeight: 1.15 }}>{school.name}</Typography>
          <Typography sx={{ fontSize: '2.8mm', color: '#5f6a63' }}>{[school.address, school.phone, school.email].filter(Boolean).join(' · ')}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography sx={{ fontSize: '3mm', fontWeight: 800, letterSpacing: '0.3mm', color: brand.green }}>PAYSLIP</Typography>
          <Typography sx={{ fontSize: '3.4mm', fontWeight: 700 }}>{label}</Typography>
        </Box>
      </Stack>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: '3mm' }}>
        <Box>
          <Typography sx={{ fontSize: '3.8mm', fontWeight: 800 }}>{line.name}</Typography>
          <Typography sx={{ fontSize: '3mm', color: '#5f6a63' }}>{[line.role, line.number].filter(Boolean).join(' · ')}</Typography>
        </Box>
        {line.accountNumber && (
          <Box sx={{ textAlign: 'right' }}>
            <Typography sx={{ fontSize: '3mm', color: '#5f6a63' }}>Paid to</Typography>
            <Typography sx={{ fontSize: '3.1mm', fontWeight: 600 }}>{line.bankName} ••{line.accountNumber.slice(-4)}</Typography>
          </Box>
        )}
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6mm' }}>
        <Box>
          <Typography sx={{ fontSize: '2.8mm', fontWeight: 800, color: '#5f6a63', letterSpacing: '0.2mm', mb: '1mm' }}>EARNINGS</Typography>
          {earnings.map(([k, v], i) => <Row key={i} k={k} v={v} />)}
          <Row k="Gross pay" v={line.gross} strong />
        </Box>
        <Box>
          <Typography sx={{ fontSize: '2.8mm', fontWeight: 800, color: '#5f6a63', letterSpacing: '0.2mm', mb: '1mm' }}>DEDUCTIONS</Typography>
          {less.length ? less.map(([k, v], i) => <Row key={i} k={k} v={v} minus />) : <Typography sx={{ fontSize: '3.2mm', color: '#5f6a63', py: '1.2mm' }}>None</Typography>}
          <Row k="Total deductions" v={line.totalDeductions} strong />
        </Box>
      </Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: '4mm', p: '3mm', bgcolor: '#e3f4ec', borderRadius: '1.5mm' }}>
        <Typography sx={{ fontSize: '3.8mm', fontWeight: 800 }}>Net pay</Typography>
        <Typography sx={{ fontSize: '5mm', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{money(line.net)}</Typography>
      </Stack>
      {line.paid && (
        <Typography sx={{ fontSize: '2.8mm', color: '#5f6a63', mt: '2mm' }}>
          Paid on {new Date(`${line.paid.on}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} by {PAY_METHOD[line.paid.method].toLowerCase()}{line.paid.reference ? ` · ref ${line.paid.reference}` : ''}
        </Typography>
      )}
    </Box>
  )
}

/** Print styles: only the payslips print, two to a page. */
export const PAYSLIP_PRINT_CSS = `
  @page { size: A4; margin: 10mm; }
  @media print {
    body * { visibility: hidden; }
    .payslips, .payslips * { visibility: visible; }
    .payslips { position: absolute; left: 0; top: 0; }
    .payslip { margin: 0 0 8mm 0 !important; box-shadow: none !important; }
    .payslip:nth-of-type(2n) { break-after: page; }
  }
`
