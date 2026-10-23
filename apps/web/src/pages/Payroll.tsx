import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert, Autocomplete, Box, Button, ButtonBase, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  IconButton, MenuItem, Paper, Stack, Tab, Tabs, TextField, Typography, useMediaQuery, useTheme,
} from '@mui/material'
import { Add as AddIcon, ChevronRight as OpenIcon, Delete as DeleteIcon, Edit as EditIcon, WarningAmberRounded as WarnIcon } from '@mui/icons-material'
import { brand } from '../theme'
import PayItemsEditor, { EditableItem, fromEditable, toEditable } from '../components/PayItemsEditor'
import {
  OtherStaff, PayPerson, PayrollSettings, RunSummary, createRun, getOtherStaff, getPayPeople, getPayrollSettings, getRuns,
  lagosMonth, money, monthLabel, removeOtherStaff, saveOtherStaff, savePayPerson, savePayrollSettings, shiftMonth,
} from '../lib/payrollApi'

const BANKS = [
  'Access Bank', 'Citibank', 'Ecobank', 'Fidelity Bank', 'First Bank', 'FCMB', 'Globus Bank', 'GTBank', 'Jaiz Bank', 'Keystone Bank',
  'Kuda', 'Lotus Bank', 'Moniepoint', 'OPay', 'Optimus Bank', 'PalmPay', 'Parallex Bank', 'Polaris Bank', 'PremiumTrust Bank', 'Providus Bank',
  'Signature Bank', 'Stanbic IBTC', 'Standard Chartered', 'Sterling Bank', 'SunTrust Bank', 'Titan Trust Bank', 'UBA', 'Union Bank', 'Unity Bank',
  'Wema Bank', 'Zenith Bank',
]
const errorText = (err: any, fallback: string) => err?.response?.data?.message || fallback
const maskAccount = (n: string) => (n ? `••${n.slice(-4)}` : '')

function StatusChip({ r }: { r: RunSummary }) {
  const paid = r.status === 'APPROVED' && r.people > 0 && r.paidCount === r.people
  const look = r.status === 'DRAFT' ? { t: 'Draft', bg: '#efeee8', fg: '#646b64' }
    : paid ? { t: 'Paid', bg: '#e3f4ec', fg: '#0b4a36' }
    : { t: r.paidCount ? `Approved · ${r.paidCount}/${r.people} paid` : 'Approved', bg: '#e6eefa', fg: '#1a569e' }
  return <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 999, fontSize: '12px', fontWeight: 700, bgcolor: look.bg, color: look.fg, whiteSpace: 'nowrap' }}>{look.t}</Box>
}

/** Months: start a month's payroll and open past ones. */
function Months() {
  const navigate = useNavigate()
  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [month, setMonth] = useState(lagosMonth())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => { getRuns().then(setRuns).catch((e) => setError(errorText(e, "Couldn't load payroll."))) }, [])
  const choices = [1, 0, -1, -2, -3].map((n) => shiftMonth(lagosMonth(), n))
  const exists = runs?.some((r) => r.month === month)

  const start = async () => {
    if (exists) return navigate(`/payroll/${month}`)
    setBusy(true)
    setError('')
    try {
      await createRun(month)
      navigate(`/payroll/${month}`)
    } catch (e) {
      setError(errorText(e, "Couldn't start the payroll."))
      setBusy(false)
    }
  }

  return (
    <Stack spacing={2}>
      <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Run payroll</Typography>
        <Typography sx={{ fontSize: '13.5px', color: brand.muted, mb: 1.5 }}>
          Everyone's pay is filled in from their pay details, with lateness from the gate. Add one-off items, then the owner or principal approves it.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <TextField select size="small" label="Month" value={month} onChange={(e) => setMonth(e.target.value)} sx={{ minWidth: 200 }}>
            {choices.map((m) => <MenuItem key={m} value={m}>{monthLabel(m)}</MenuItem>)}
          </TextField>
          <Button variant="contained" onClick={start} disabled={busy || !runs}>{busy ? 'Starting…' : exists ? `Open ${monthLabel(month)}` : `Start ${monthLabel(month)} payroll`}</Button>
        </Stack>
        {error && <Alert severity="error" sx={{ mt: 1.5 }}>{error}</Alert>}
      </Paper>

      <Paper>
        {!runs ? <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={26} /></Stack>
          : runs.length === 0 ? <Typography sx={{ p: 3, color: brand.muted, textAlign: 'center' }}>No payroll yet. Set everyone's pay on the Pay details tab, then start this month's payroll.</Typography>
          : runs.map((r, i) => (
            <ButtonBase key={r.month} onClick={() => navigate(`/payroll/${r.month}`)}
              sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 2, sm: 2.5 }, py: 1.5, textAlign: 'left', borderTop: i ? `1px solid ${brand.border}` : 'none', '&:hover': { bgcolor: '#f7f6f1' } }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 700 }}>{r.label}</Typography>
                <Typography sx={{ fontSize: '12.5px', color: brand.muted }}>{r.people} {r.people === 1 ? 'person' : 'people'} · net {money(r.net)}</Typography>
              </Box>
              <StatusChip r={r} />
              <OpenIcon sx={{ color: brand.subtle }} />
            </ButtonBase>
          ))}
      </Paper>
    </Stack>
  )
}

/** Pay details: each person's basic pay, regular allowances and deductions, and bank account. */
function PayDetails() {
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const [people, setPeople] = useState<PayPerson[] | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<PayPerson | null>(null)
  const [form, setForm] = useState({ basic: '', allowances: [] as EditableItem[], deductions: [] as EditableItem[], bankName: '', accountNumber: '', accountName: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const load = useCallback(() => { getPayPeople().then(setPeople).catch((e) => setError(errorText(e, "Couldn't load pay details."))) }, [])
  useEffect(load, [load])

  const open = (p: PayPerson) => {
    setEditing(p)
    setFormError('')
    setForm({ basic: p.basic ? String(p.basic) : '', allowances: toEditable(p.allowances), deductions: toEditable(p.deductions), bankName: p.bankName, accountNumber: p.accountNumber, accountName: p.accountName || `${p.firstName} ${p.lastName}`.trim() })
  }
  const basic = Number(form.basic.replace(/[₦,\s]/g, '') || 0)
  const gross = basic + fromEditable(form.allowances).reduce((a, i) => a + i.amount, 0)
  const net = gross - fromEditable(form.deductions).reduce((a, i) => a + i.amount, 0)

  const save = async () => {
    if (!editing) return
    if (!Number.isFinite(basic) || basic < 0) return setFormError('Enter the basic pay as a number, like 150000.')
    setSaving(true)
    setFormError('')
    try {
      await savePayPerson(editing.key, { basic, allowances: fromEditable(form.allowances), deductions: fromEditable(form.deductions), bankName: form.bankName, accountNumber: form.accountNumber, accountName: form.accountName })
      setEditing(null)
      load()
    } catch (e) {
      setFormError(errorText(e, "Couldn't save."))
    } finally {
      setSaving(false)
    }
  }

  const missing = people?.filter((p) => p.gross > 0 && !p.accountNumber).length ?? 0
  return (
    <>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {missing > 0 && <Alert severity="warning" sx={{ mb: 2 }}>{missing} {missing === 1 ? 'person has' : 'people have'} pay but no bank account. They'll be left out of the bank upload file.</Alert>}
      <Paper>
        {!people ? <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={26} /></Stack>
          : people.length === 0 ? <Typography sx={{ p: 3, color: brand.muted, textAlign: 'center' }}>No staff yet. Add teachers on the Teachers page, or other staff on the Other staff tab.</Typography>
          : people.map((p, i) => (
            <Stack key={p.key} direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 2, sm: 2.5 }, py: 1.25, borderTop: i ? `1px solid ${brand.border}` : 'none' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 600 }}>{p.firstName} {p.lastName}</Typography>
                <Typography noWrap sx={{ fontSize: '12.5px', color: brand.muted }}>
                  {[p.role, p.accountNumber ? `${p.bankName} ${maskAccount(p.accountNumber)}` : p.gross > 0 ? 'No bank account' : null].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
              <Box sx={{ textAlign: 'right' }}>
                <Typography sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: p.gross ? brand.text : brand.subtle }}>{p.gross ? money(p.net) : 'No pay set'}</Typography>
                {!!p.gross && !isPhone && <Typography sx={{ fontSize: '12px', color: brand.subtle }}>net · gross {money(p.gross)}</Typography>}
              </Box>
              <IconButton size="small" aria-label={`Edit pay for ${p.firstName} ${p.lastName}`} onClick={() => open(p)}><EditIcon fontSize="small" /></IconButton>
            </Stack>
          ))}
      </Paper>

      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="sm" fullWidth fullScreen={isPhone}>
        <DialogTitle>Pay for {editing?.firstName} {editing?.lastName}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <TextField label="Basic monthly pay (₦)" placeholder="e.g. 150000" value={form.basic} onChange={(e) => setForm({ ...form, basic: e.target.value })} inputProps={{ inputMode: 'decimal' }}
              helperText={editing?.key.startsWith('T_') ? "This is also the salary on their teacher record." : ' '} />
            <PayItemsEditor title="Monthly allowances" items={form.allowances} onChange={(allowances) => setForm({ ...form, allowances })} examples={['Transport', '20000']} addLabel="Add allowance" />
            <PayItemsEditor title="Monthly deductions" items={form.deductions} onChange={(deductions) => setForm({ ...form, deductions })} examples={['Pension', '12000']} addLabel="Add deduction" />
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: '#fafaf6' }}>
              <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '13.5px' }}>Gross pay</Typography><Typography sx={{ fontWeight: 700 }}>{money(gross)}</Typography></Stack>
              <Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: '13.5px' }}>Net pay before lateness and one-off items</Typography><Typography sx={{ fontWeight: 700, color: net < 0 ? '#9b2a22' : brand.text }}>{money(net)}</Typography></Stack>
            </Paper>
            <Typography sx={{ fontSize: '13px', fontWeight: 700, color: brand.muted }}>Bank account</Typography>
            <Autocomplete freeSolo options={BANKS} value={form.bankName} onInputChange={(_, v) => setForm({ ...form, bankName: v })}
              renderInput={(params) => <TextField {...params} label="Bank" placeholder="e.g. GTBank" />} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
              <TextField fullWidth label="Account number" placeholder="10 digits" value={form.accountNumber} onChange={(e) => setForm({ ...form, accountNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })} inputProps={{ inputMode: 'numeric' }} />
              <TextField fullWidth label="Account name" placeholder="As the bank has it" value={form.accountName} onChange={(e) => setForm({ ...form, accountName: e.target.value })} />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

/** Other staff: people without a teacher record or sign-in, such as security, cleaners, cooks and drivers. */
function Others() {
  const [list, setList] = useState<OtherStaff[] | null>(null)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState<OtherStaff | 'new' | null>(null)
  const empty = { firstName: '', lastName: '', role: '', staffNumber: '', phone: '', email: '' }
  const [form, setForm] = useState(empty)
  const [formError, setFormError] = useState('')
  const load = useCallback(() => { getOtherStaff().then(setList).catch((e) => setError(errorText(e, "Couldn't load other staff."))) }, [])
  useEffect(load, [load])

  const save = async () => {
    setFormError('')
    try {
      await saveOtherStaff(editing === 'new' ? null : editing!.id, form)
      setEditing(null)
      load()
    } catch (e) {
      setFormError(errorText(e, "Couldn't save."))
    }
  }
  const remove = async (s: OtherStaff) => {
    if (!window.confirm(`Remove ${s.firstName} ${s.lastName}? Their ID card will stop working and they'll be left out of future payrolls.`)) return
    try { await removeOtherStaff(s.id); load() } catch (e) { setError(errorText(e, "Couldn't remove.")) }
  }

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <Typography sx={{ flex: 1, fontSize: '13.5px', color: brand.muted }}>
          Security, cleaners, cooks, drivers and anyone else who works at the school without a teacher record. They get staff ID cards, clock in at the gate and are paid through payroll.
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => { setForm(empty); setFormError(''); setEditing('new') }} sx={{ whiteSpace: 'nowrap' }}>Add staff</Button>
      </Stack>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Paper>
        {!list ? <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={26} /></Stack>
          : list.length === 0 ? <Typography sx={{ p: 3, color: brand.muted, textAlign: 'center' }}>No other staff yet.</Typography>
          : list.map((s, i) => (
            <Stack key={s.id} direction="row" alignItems="center" spacing={1} sx={{ px: { xs: 2, sm: 2.5 }, py: 1.25, borderTop: i ? `1px solid ${brand.border}` : 'none' }}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography noWrap sx={{ fontWeight: 600 }}>{s.firstName} {s.lastName}</Typography>
                <Typography noWrap sx={{ fontSize: '12.5px', color: brand.muted }}>{[s.role, s.staffNumber, s.phone].filter(Boolean).join(' · ')}</Typography>
              </Box>
              <IconButton size="small" aria-label={`Edit ${s.firstName} ${s.lastName}`} onClick={() => { setForm({ firstName: s.firstName, lastName: s.lastName, role: s.role, staffNumber: s.staffNumber, phone: s.phone, email: s.email }); setFormError(''); setEditing(s) }}><EditIcon fontSize="small" /></IconButton>
              <IconButton size="small" aria-label={`Remove ${s.firstName} ${s.lastName}`} onClick={() => remove(s)}><DeleteIcon fontSize="small" /></IconButton>
            </Stack>
          ))}
      </Paper>
      <Dialog open={!!editing} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{editing === 'new' ? 'Add staff' : 'Edit staff'}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            {formError && <Alert severity="error">{formError}</Alert>}
            <Stack direction="row" spacing={1.5}>
              <TextField fullWidth label="First name" placeholder="e.g. Musa" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
              <TextField fullWidth label="Last name" placeholder="e.g. Bello" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </Stack>
            <Autocomplete freeSolo options={['Security', 'Cleaner', 'Cook', 'Driver', 'Gardener', 'Nurse', 'Librarian', 'Lab attendant', 'Bursar', 'Secretary', 'Porter']}
              value={form.role} onInputChange={(_, v) => setForm({ ...form, role: v })} renderInput={(params) => <TextField {...params} label="Job" placeholder="e.g. Security" />} />
            <TextField label="Staff number (optional)" placeholder="e.g. GFA-S-004" value={form.staffNumber} onChange={(e) => setForm({ ...form, staffNumber: e.target.value })} />
            <TextField label="Phone (optional)" placeholder="e.g. 08031234567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <TextField label="Email (optional, for payslips)" placeholder="e.g. musa@gmail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!form.firstName.trim() || !form.lastName.trim() || !form.role.trim()}>Save</Button>
        </DialogActions>
      </Dialog>
    </>
  )
}

/** Lateness: the deduction per late day after any free ones, from the gate's staff clock-ins. */
function Lateness() {
  const navigate = useNavigate()
  const [s, setS] = useState<PayrollSettings | null>(null)
  const [amount, setAmount] = useState('')
  const [free, setFree] = useState('0')
  const [note, setNote] = useState('')
  useEffect(() => { getPayrollSettings().then((x) => { setS(x); setAmount(x.latePenalty ? String(x.latePenalty) : ''); setFree(String(x.freeLates)) }).catch(() => {}) }, [])
  const save = async () => {
    setNote('')
    try {
      const x = await savePayrollSettings({ latePenalty: amount.trim() ? Number(amount.replace(/[₦,\s]/g, '')) : null, freeLates: Number(free) || 0 })
      setS(x)
      setNote(x.latePenalty ? `Saved. ${money(x.latePenalty)} per late day${x.freeLates ? ` after the first ${x.freeLates} in a month` : ''}.` : 'Saved. Lateness is not deducted.')
    } catch (e) {
      setNote(errorText(e, "Couldn't save."))
    }
  }
  if (!s) return <Stack alignItems="center" sx={{ py: 4 }}><CircularProgress size={26} /></Stack>
  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 }, maxWidth: 620 }}>
      <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Lateness deduction</Typography>
      <Typography sx={{ fontSize: '13.5px', color: brand.muted, mb: 2 }}>
        Staff who clock in at the gate after the staff "late after" time are counted late. Each month's payroll deducts this amount for every late day beyond the free ones. You can waive it for anyone in the month's payroll.
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
        <TextField label="Deduction per late day (₦)" placeholder="e.g. 500" value={amount} onChange={(e) => setAmount(e.target.value)} inputProps={{ inputMode: 'decimal' }} helperText="Leave empty to not deduct." sx={{ minWidth: 220 }} />
        <TextField select label="Free late days each month" value={free} onChange={(e) => setFree(e.target.value)} sx={{ minWidth: 200 }} helperText=" ">
          {[0, 1, 2, 3, 4, 5].map((n) => <MenuItem key={n} value={String(n)}>{n === 0 ? 'None' : n}</MenuItem>)}
        </TextField>
        <Button variant="contained" onClick={save} sx={{ mt: { sm: 1 } }}>Save</Button>
      </Stack>
      {note && <Typography sx={{ fontSize: '13px', color: brand.muted, mt: 1 }}>{note}</Typography>}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2, color: brand.muted }}>
        <WarnIcon sx={{ fontSize: 18 }} />
        <Typography sx={{ fontSize: '12.5px' }}>
          Set the staff "late after" time on the <Box component="span" onClick={() => navigate('/gate')} sx={{ color: brand.green, fontWeight: 600, cursor: 'pointer' }}>Gate</Box> page, and check late days on <Box component="span" onClick={() => navigate('/staff-attendance')} sx={{ color: brand.green, fontWeight: 600, cursor: 'pointer' }}>Staff attendance</Box>.
        </Typography>
      </Stack>
    </Paper>
  )
}

const TABS = ['months', 'pay', 'others', 'lateness'] as const

/** Payroll: monthly runs, pay details, other staff and the lateness deduction. */
export default function Payroll() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS as readonly string[]).includes(params.get('tab') ?? '') ? (params.get('tab') as (typeof TABS)[number]) : 'months'
  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1000, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Typography variant="h4">Payroll</Typography>
      <Typography sx={{ color: brand.muted, fontSize: '14.5px', mb: 2 }}>Monthly pay for teachers and staff: approval, payslips and a bank upload file. Only the owner, principal and accountant can see this.</Typography>
      <Tabs value={tab} onChange={(_, v) => setParams(v === 'months' ? {} : { tab: v }, { replace: true })} variant="scrollable" allowScrollButtonsMobile sx={{ mb: 2, borderBottom: `1px solid ${brand.border}` }}>
        <Tab value="months" label="Months" />
        <Tab value="pay" label="Pay details" />
        <Tab value="others" label="Other staff" />
        <Tab value="lateness" label="Lateness" />
      </Tabs>
      {tab === 'months' && <Months />}
      {tab === 'pay' && <PayDetails />}
      {tab === 'others' && <Others />}
      {tab === 'lateness' && <Lateness />}
    </Box>
  )
}
