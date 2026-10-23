import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert, Box, Button, ButtonBase, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Paper, Stack, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import {
  ArrowBack as BackIcon, CheckCircleOutline as ApproveIcon, Download as DownloadIcon, EmailOutlined as EmailIcon,
  Print as PrintIcon, Refresh as RefreshIcon, Payments as PayIcon,
} from '@mui/icons-material'
import Papa from 'papaparse'
import { brand } from '../theme'
import { useAuthStore } from '../store/authStore'
import { PAYROLL_APPROVERS } from '../lib/roles'
import PayItemsEditor, { EditableItem, fromEditable, toEditable } from '../components/PayItemsEditor'
import Payslip, { PAYSLIP_PRINT_CSS } from '../components/Payslip'
import {
  PAY_METHOD, PayLine, PayMethod, Run, approveRun, deleteRun, editLine, emailPayslips, getRun, markPaid, money, rebuildRun, reopenRun, unpay,
} from '../lib/payrollApi'

const errorText = (err: any, fallback: string) => err?.response?.data?.message || fallback
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })

/** One month's payroll: check and adjust, approve, record payments, payslips and the bank file. */
export default function PayrollRun() {
  const { month = '' } = useParams()
  const navigate = useNavigate()
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const approver = PAYROLL_APPROVERS.includes(useAuthStore((s) => s.user?.role) ?? '')
  const [run, setRun] = useState<Run | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<PayLine | null>(null)
  const [extras, setExtras] = useState<{ pay: EditableItem[]; less: EditableItem[]; waive: boolean; excluded: boolean }>({ pay: [], less: [], waive: false, excluded: false })
  const [paying, setPaying] = useState<{ keys?: string[]; who: string } | null>(null)
  const [payForm, setPayForm] = useState({ paidOn: today(), method: 'TRANSFER' as PayMethod, reference: '' })
  const [printing, setPrinting] = useState<string[] | null>(null)

  const load = useCallback(() => { getRun(month).then(setRun).catch((e) => setError(errorText(e, "Couldn't load this payroll."))) }, [month])
  useEffect(load, [load])

  // Print once the chosen payslips are on the page; keep them there until printing finishes
  // (on some phones window.print() returns before the page is printed).
  useEffect(() => {
    if (!printing) return
    const done = () => setPrinting(null)
    window.addEventListener('afterprint', done)
    const t = setTimeout(() => window.print(), 300)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', done) }
  }, [printing])

  const act = async (fn: () => Promise<Run | unknown>, done?: string) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const r = await fn()
      if (r && typeof r === 'object' && 'lines' in (r as Run)) setRun(r as Run)
      if (done) setNotice(done)
      return true
    } catch (e) {
      setError(errorText(e, 'Something went wrong. Try again.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  if (!run) {
    return (
      <Box sx={{ maxWidth: 1000, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/payroll')} sx={{ mb: 2, ml: -1, color: brand.muted }}>Payroll</Button>
        {error ? <Alert severity="error">{error}</Alert> : <Stack alignItems="center" sx={{ py: 8 }}><CircularProgress size={28} /></Stack>}
      </Box>
    )
  }

  const draft = run.status === 'DRAFT'
  const included = run.lines.filter((l) => !l.excluded)
  const unpaid = included.filter((l) => !l.paid)
  const allPaid = !draft && included.length > 0 && unpaid.length === 0

  const openLine = (l: PayLine) => {
    setOpen(l)
    setExtras({ pay: toEditable(l.extraPay), less: toEditable(l.extraDeductions), waive: l.waiveLateness, excluded: l.excluded })
  }
  const saveLine = async () => {
    if (!open) return
    if (await act(() => editLine(month, open.key, { extraPay: fromEditable(extras.pay), extraDeductions: fromEditable(extras.less), waiveLateness: extras.waive, excluded: extras.excluded }))) setOpen(null)
  }

  const bankFile = () => {
    const rows = included.filter((l) => l.net > 0 && l.accountNumber)
    const missing = included.filter((l) => l.net > 0 && !l.accountNumber)
    const csv = '﻿' + Papa.unparse({
      fields: ['Account Name', 'Account Number', 'Bank', 'Amount', 'Narration'],
      data: rows.map((l) => [l.accountName || l.name, l.accountNumber, l.bankName, l.net.toFixed(2), `${run.school.name} salary ${run.label}`.slice(0, 60)]),
    })
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `salaries-${month}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setNotice(`Bank file downloaded for ${rows.length} ${rows.length === 1 ? 'person' : 'people'}, ${money(rows.reduce((s, l) => s + l.net, 0))} in total.${missing.length ? ` Left out (no bank account): ${missing.map((l) => l.name).join(', ')}.` : ''} Check the column order your bank's bulk-payment page expects.`)
  }

  const sendEmails = () => act(async () => {
    const r = await emailPayslips(month)
    setNotice(`Payslips emailed to ${r.sent} ${r.sent === 1 ? 'person' : 'people'}.${r.noEmail.length ? ` No email address for: ${r.noEmail.join(', ')}.` : ''}${r.failed.length ? ` Couldn't send to: ${r.failed.join(', ')}.` : ''}`)
    return null
  })

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1000, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <style>{PAYSLIP_PRINT_CSS}</style>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/payroll')} sx={{ mb: 1, ml: -1, color: brand.muted }}>Payroll</Button>
      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.5 }}>
        <Typography variant="h4">{run.label} payroll</Typography>
        <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 999, fontSize: '12px', fontWeight: 700, bgcolor: draft ? '#efeee8' : allPaid ? '#e3f4ec' : '#e6eefa', color: draft ? '#646b64' : allPaid ? '#0b4a36' : '#1a569e' }}>
          {draft ? 'Draft' : allPaid ? 'Paid' : 'Approved'}
        </Box>
      </Stack>
      <Typography sx={{ color: brand.muted, fontSize: '13.5px', mb: 2 }}>
        {[run.createdByName && `Prepared by ${run.createdByName}`, run.approvedByName && `approved by ${run.approvedByName}`].filter(Boolean).join(', ') || ' '}
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5, mb: 2 }}>
        {[
          { label: 'People', value: String(run.people) },
          { label: 'Gross pay', value: money(run.gross) },
          { label: 'Deductions', value: money(run.deductions) },
          { label: draft ? 'Net to pay' : `Net · ${run.paidCount}/${run.people} paid`, value: money(run.net) },
        ].map((t) => (
          <Paper key={t.label} sx={{ p: { xs: 1.5, sm: 2 } }}>
            <Typography sx={{ fontSize: { xs: '19px', sm: '23px' }, fontWeight: 800, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>{t.value}</Typography>
            <Typography sx={{ fontSize: '12.5px', color: brand.muted }}>{t.label}</Typography>
          </Paper>
        ))}
      </Box>

      {/* Actions */}
      <Paper sx={{ p: { xs: 1.5, sm: 2 }, mb: 2 }}>
        {draft ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <Typography sx={{ flex: 1, fontSize: '13.5px', color: brand.muted }}>
              Check each person, add one-off items such as bonuses or advances, then {approver ? 'approve it.' : 'ask the owner or principal to approve it.'}
            </Typography>
            <Button startIcon={<RefreshIcon />} disabled={busy} onClick={() => act(() => rebuildRun(month), "Updated from everyone's latest pay details and late days.")}>Refresh from pay details</Button>
            {approver && <Button variant="contained" startIcon={<ApproveIcon />} disabled={busy} onClick={() => window.confirm(`Approve ${run.label} payroll: ${money(run.net)} to ${run.people} ${run.people === 1 ? 'person' : 'people'}? It can't be changed afterwards unless reopened.`) && act(() => approveRun(month), 'Approved. You can now record payments, print payslips and download the bank file.')}>Approve</Button>}
            {approver && <Button color="error" disabled={busy} onClick={async () => { if (window.confirm('Delete this draft payroll?') && (await act(() => deleteRun(month)))) navigate('/payroll') }}>Delete draft</Button>}
          </Stack>
        ) : (
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {unpaid.length > 0 && <Button variant="contained" startIcon={<PayIcon />} disabled={busy} onClick={() => { setPayForm({ paidOn: today(), method: 'TRANSFER', reference: '' }); setPaying({ who: `${unpaid.length} unpaid ${unpaid.length === 1 ? 'person' : 'people'}` }) }}>Record payment for all unpaid</Button>}
            <Button variant="outlined" startIcon={<DownloadIcon />} onClick={bankFile}>Bank upload file</Button>
            <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => setPrinting(included.map((l) => l.key))}>Print payslips</Button>
            <Button variant="outlined" startIcon={<EmailIcon />} disabled={busy} onClick={() => window.confirm('Email each person their payslip?') && sendEmails()}>Email payslips</Button>
            {approver && run.paidCount === 0 && <Button disabled={busy} onClick={() => act(() => reopenRun(month), 'Reopened as a draft. Approve it again when ready.')}>Reopen</Button>}
          </Stack>
        )}
      </Paper>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {notice && <Alert severity="info" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

      {/* People */}
      <Paper>
        {run.lines.map((l, i) => (
          <ButtonBase key={l.key} onClick={() => openLine(l)}
            sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 1.5, sm: 2.5 }, py: 1.25, textAlign: 'left', borderTop: i ? `1px solid ${brand.border}` : 'none', opacity: l.excluded ? 0.55 : 1, '&:hover': { bgcolor: '#f7f6f1' } }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: 600 }}>{l.name}</Typography>
              <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography noWrap sx={{ fontSize: '12.5px', color: brand.muted }}>{l.role}</Typography>
                {l.excluded && <Tag bg="#efeee8" fg="#646b64">{l.gross ? 'Left out' : 'No pay set'}</Tag>}
                {!l.excluded && l.lateDays > 0 && <Tag bg="#fdf0d5" fg="#7a4c00">{l.lateDays} late{l.lateDeduction ? ` · −${money(l.lateDeduction)}` : l.waiveLateness ? ' · waived' : ''}</Tag>}
                {!l.excluded && !l.accountNumber && l.net > 0 && <Tag bg="#fbe4e2" fg="#9b2a22">No bank account</Tag>}
                {l.paid && <Tag bg="#e3f4ec" fg="#0b4a36">Paid {new Date(`${l.paid.on}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</Tag>}
              </Stack>
            </Box>
            {!l.excluded && (
              <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                <Typography sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums', color: l.net < 0 ? '#9b2a22' : brand.text }}>{money(l.net)}</Typography>
                {!isPhone && <Typography sx={{ fontSize: '12px', color: brand.subtle }}>{money(l.gross)} − {money(l.totalDeductions)}</Typography>}
              </Box>
            )}
          </ButtonBase>
        ))}
      </Paper>

      {/* One person */}
      <Dialog open={!!open} onClose={() => setOpen(null)} maxWidth="sm" fullWidth fullScreen={isPhone}>
        {open && (() => {
          const line = run.lines.find((x) => x.key === open.key) ?? open
          return (
            <>
              <DialogTitle>{line.name} · {run.label}</DialogTitle>
              <DialogContent>
                <Stack spacing={2} sx={{ pt: 1 }}>
                  <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#fafaf6' }}>
                    <Line k="Basic pay" v={money(line.basic)} />
                    {line.allowances.map((a, i) => <Line key={`a${i}`} k={a.label} v={money(a.amount)} />)}
                    {line.deductions.map((d, i) => <Line key={`d${i}`} k={d.label} v={`−${money(d.amount)}`} />)}
                    {line.lateDays > 0 && <Line k={`Lateness: ${line.lateDays} late ${line.lateDays === 1 ? 'day' : 'days'}${run.settings.freeLates ? ` (${run.settings.freeLates} free)` : ''}`} v={line.waiveLateness ? 'Waived' : line.lateDeduction ? `−${money(line.lateDeduction)}` : 'No deduction'} />}
                    {!draft && line.extraPay.map((a, i) => <Line key={`x${i}`} k={a.label} v={money(a.amount)} />)}
                    {!draft && line.extraDeductions.map((d, i) => <Line key={`y${i}`} k={d.label} v={`−${money(d.amount)}`} />)}
                    <Line k="Net pay" v={money(line.net)} strong />
                  </Paper>
                  {draft ? (
                    <>
                      <PayItemsEditor title="One-off pay this month" items={extras.pay} onChange={(pay) => setExtras({ ...extras, pay })} examples={['Exam bonus', '10000']} addLabel="Add pay" />
                      <PayItemsEditor title="One-off deductions this month" items={extras.less} onChange={(less) => setExtras({ ...extras, less })} examples={['Salary advance', '30000']} addLabel="Add deduction" />
                      {line.lateDays > 0 && <FormControlLabel control={<Checkbox checked={extras.waive} onChange={(e) => setExtras({ ...extras, waive: e.target.checked })} />} label="Waive the lateness deduction this month" />}
                      <FormControlLabel control={<Checkbox checked={extras.excluded} onChange={(e) => setExtras({ ...extras, excluded: e.target.checked })} />} label="Leave out of this month's payroll" />
                    </>
                  ) : line.paid ? (
                    <Alert severity="success">Paid on {new Date(`${line.paid.on}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} by {PAY_METHOD[line.paid.method].toLowerCase()}{line.paid.reference ? ` · ref ${line.paid.reference}` : ''}.</Alert>
                  ) : null}
                </Stack>
              </DialogContent>
              <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
                {!draft && !line.excluded && <Button startIcon={<PrintIcon />} onClick={() => { setOpen(null); setPrinting([line.key]) }}>Payslip</Button>}
                {!draft && line.paid && approver && <Button color="error" disabled={busy} onClick={async () => { if (window.confirm(`Undo the payment record for ${line.name}?`) && (await act(() => unpay(month, line.key)))) setOpen(null) }}>Undo payment</Button>}
                <Box sx={{ flex: 1 }} />
                <Button onClick={() => setOpen(null)}>Close</Button>
                {draft && <Button variant="contained" onClick={saveLine} disabled={busy}>Save</Button>}
                {!draft && !line.paid && !line.excluded && <Button variant="contained" onClick={() => { setOpen(null); setPayForm({ paidOn: today(), method: 'TRANSFER', reference: '' }); setPaying({ keys: [line.key], who: line.name }) }}>Record payment</Button>}
              </DialogActions>
            </>
          )
        })()}
      </Dialog>

      {/* Record payment */}
      <Dialog open={!!paying} onClose={() => setPaying(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Record payment · {paying?.who}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField type="date" label="Date paid" value={payForm.paidOn} onChange={(e) => setPayForm({ ...payForm, paidOn: e.target.value })} InputLabelProps={{ shrink: true }} inputProps={{ max: today() }} />
            <TextField select label="Paid by" value={payForm.method} onChange={(e) => setPayForm({ ...payForm, method: e.target.value as PayMethod })}>
              {(Object.keys(PAY_METHOD) as PayMethod[]).map((m) => <MenuItem key={m} value={m}>{PAY_METHOD[m]}</MenuItem>)}
            </TextField>
            <TextField label="Reference (optional)" placeholder="e.g. bank batch number" value={payForm.reference} onChange={(e) => setPayForm({ ...payForm, reference: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaying(null)}>Cancel</Button>
          <Button variant="contained" disabled={busy || !payForm.paidOn} onClick={async () => { if (await act(() => markPaid(month, { keys: paying!.keys, ...payForm }), 'Payment recorded.')) setPaying(null) }}>Record</Button>
        </DialogActions>
      </Dialog>

      {/* Payslips to print (hidden on screen) */}
      {printing && (
        <Box className="payslips" sx={{ position: 'fixed', left: -10000, top: 0, '@media print': { position: 'absolute', left: 0 } }}>
          {run.lines.filter((l) => printing.includes(l.key)).map((l) => <Box key={l.key} sx={{ mb: '8mm' }}><Payslip school={run.school} label={run.label} line={l} /></Box>)}
        </Box>
      )}
    </Box>
  )
}

function Tag({ bg, fg, children }: { bg: string; fg: string; children: React.ReactNode }) {
  return <Box component="span" sx={{ px: 0.75, py: 0.1, borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, bgcolor: bg, color: fg, whiteSpace: 'nowrap' }}>{children}</Box>
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.4, borderTop: strong ? `1px solid ${brand.border}` : 'none', mt: strong ? 0.5 : 0, pt: strong ? 0.75 : 0.4 }}>
      <Typography sx={{ fontSize: '13.5px', fontWeight: strong ? 800 : 400 }}>{k}</Typography>
      <Typography sx={{ fontSize: '13.5px', fontWeight: strong ? 800 : 600, fontVariantNumeric: 'tabular-nums' }}>{v}</Typography>
    </Stack>
  )
}
