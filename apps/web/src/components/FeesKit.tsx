import { ReactNode, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  GlobalStyles,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { PrintOutlined as PrintIcon } from '@mui/icons-material'
import { api } from '../lib/api'
import { schoolToday } from '../lib/attendanceApi'
import { TERMS, TERM_LABEL, Term, currentSession, currentTerm } from '../lib/examsApi'
import {
  FEE_STATUS_STYLE,
  FeeStatus,
  METHODS,
  METHOD_LABEL,
  Method,
  Receipt,
  Statement,
  getStatement,
  naira,
  parseNaira,
  recordPayment,
  saveDiscount,
} from '../lib/feesApi'
import { brand } from '../theme'

const errorText = (err: any, fallback: string) => {
  const msg = err?.response?.data?.message
  return Array.isArray(msg) ? msg[0] : msg || fallback
}

export const longDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

/** Term and session kept in the URL (?term=FIRST&session=2026/2027), defaulting to the current term. */
export function useTermSession() {
  const [params, setParams] = useSearchParams()
  const term = (TERMS as readonly string[]).includes(params.get('term') ?? '') ? (params.get('term') as Term) : currentTerm()
  const session = /^\d{4}\/\d{4}$/.test(params.get('session') ?? '') ? params.get('session')! : currentSession()
  const set = (t: Term, s: string) => {
    const next = new URLSearchParams(params)
    next.set('term', t)
    next.set('session', s)
    setParams(next, { replace: true })
  }
  return { term, session, set }
}

/** The term before this one, e.g. First Term 2026/2027 -> Third Term 2025/2026. */
export const previousTerm = (term: Term, session: string): { term: Term; session: string } => {
  const y = Number(session.slice(0, 4))
  if (term === 'FIRST') return { term: 'THIRD', session: `${y - 1}/${y}` }
  return { term: term === 'THIRD' ? 'SECOND' : 'FIRST', session }
}

export function TermPicker({ term, session, onChange }: { term: Term; session: string; onChange: (t: Term, s: string) => void }) {
  const y = Number(currentSession().slice(0, 4))
  const sessions = [...new Set([y - 1, y, y + 1].map((v) => `${v}/${v + 1}`).concat(session))].sort()
  return (
    <Stack direction="row" spacing={1}>
      <TextField select size="small" label="Term" value={term} onChange={(e) => onChange(e.target.value as Term, session)} sx={{ width: 150 }}>
        {TERMS.map((t) => <MenuItem key={t} value={t}>{TERM_LABEL[t]}</MenuItem>)}
      </TextField>
      <TextField select size="small" label="Session" value={session} onChange={(e) => onChange(term, e.target.value)} sx={{ width: 150 }}>
        {sessions.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
      </TextField>
    </Stack>
  )
}

export function StatusBadge({ status }: { status: FeeStatus }) {
  const s = FEE_STATUS_STYLE[status]
  return (
    <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 999, fontSize: '12px', fontWeight: 600, bgcolor: s.bg, color: s.fg, whiteSpace: 'nowrap' }}>{s.label}</Box>
  )
}

/** Renders children only when printing, as the sole content of the printed page. */
export function PrintArea({ active, size = 'A4', children }: { active: boolean; size?: string; children: ReactNode }) {
  return (
    <>
      <GlobalStyles
        styles={{
          '.fee-print-root': { display: 'none' },
          '@media print': {
            '@page': { size, margin: '10mm' },
            'body > *:not(.fee-print-root)': { display: 'none !important' },
            body: { background: '#fff !important' },
            '.fee-print-root': { display: 'block !important' },
            '*': { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' },
          },
        }}
      />
      {active && createPortal(<div className="fee-print-root">{children}</div>, document.body)}
    </>
  )
}

/** Prints after the print copy has rendered. */
export function usePrint() {
  const [printing, setPrinting] = useState(false)
  const print = () => {
    setPrinting(true)
    setTimeout(() => {
      window.print()
      setPrinting(false)
    }, 250)
  }
  return { printing, print }
}

const ink = '#141a15'
const line = '#d9d6cc'
const label = { fontSize: '10.5px', fontWeight: 700, color: '#646b64', textTransform: 'uppercase' as const, letterSpacing: '0.04em' }

function SchoolHeader({ school, title }: { school: Receipt['school']; title: string }) {
  return (
    <>
      <Box sx={{ textAlign: 'center', pb: 1.25, borderBottom: `2px solid ${ink}` }}>
        <Typography sx={{ fontSize: '20px', fontWeight: 800, color: ink }}>{school.name || 'School'}</Typography>
        {school.address && <Typography sx={{ fontSize: '12px', color: '#4d534d' }}>{school.address}</Typography>}
        {(school.phone || school.email) && <Typography sx={{ fontSize: '12px', color: '#4d534d' }}>{[school.phone, school.email].filter(Boolean).join(' · ')}</Typography>}
      </Box>
      <Typography sx={{ textAlign: 'center', fontSize: '12.5px', fontWeight: 800, letterSpacing: '0.12em', mt: 1, mb: 1.5, color: ink }}>{title}</Typography>
    </>
  )
}

function Field({ k, v }: { k: string; v: ReactNode }) {
  return (
    <Box>
      <Typography sx={label}>{k}</Typography>
      <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: ink }}>{v}</Typography>
    </Box>
  )
}

/** A printable payment receipt. */
export function ReceiptSheet({ receipt: r }: { receipt: Receipt }) {
  return (
    <Box sx={{ color: ink, maxWidth: 520, mx: 'auto', position: 'relative' }}>
      {r.voided && (
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
          <Typography sx={{ fontSize: '64px', fontWeight: 900, color: 'rgba(155,42,34,0.18)', transform: 'rotate(-18deg)', letterSpacing: '0.1em' }}>VOID</Typography>
        </Box>
      )}
      <SchoolHeader school={r.school} title="PAYMENT RECEIPT" />
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.25, mb: 2 }}>
        <Field k="Receipt no." v={r.receiptNumber} />
        <Field k="Date" v={longDate(r.paidOn)} />
        <Field k="Student" v={`${r.student.firstName} ${r.student.lastName}`} />
        <Field k="Admission no." v={r.student.admissionNumber || '–'} />
        <Field k="Class" v={r.student.className ?? '–'} />
        <Field k="Term" v={`${TERM_LABEL[r.term]}, ${r.session}`} />
      </Box>
      <Box sx={{ border: `1.5px solid ${ink}`, borderRadius: '6px', p: 1.5, textAlign: 'center', mb: 2 }}>
        <Typography sx={label}>Amount received</Typography>
        <Typography sx={{ fontSize: '26px', fontWeight: 800, color: ink, fontVariantNumeric: 'tabular-nums' }}>{naira(r.amount)}</Typography>
        <Typography sx={{ fontSize: '12.5px', color: '#4d534d' }}>
          {METHOD_LABEL[r.method]}{r.reference ? ` · Ref ${r.reference}` : ''}
        </Typography>
      </Box>
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& td': { fontSize: '13px', py: 0.6, borderBottom: `1px solid ${line}`, fontVariantNumeric: 'tabular-nums' }, '& td:last-child': { textAlign: 'right', fontWeight: 600 } }}>
        <tbody>
          <tr><td>Fees due this term</td><td>{naira(r.due)}</td></tr>
          <tr><td>Paid to date (including this receipt)</td><td>{naira(r.paidToDate)}</td></tr>
          <tr><td style={{ fontWeight: 700 }}>Balance</td><td style={{ fontWeight: 800 }}>{r.balanceAfter > 0 ? naira(r.balanceAfter) : 'Fully paid'}</td></tr>
        </tbody>
      </Box>
      {r.note && <Typography sx={{ fontSize: '12.5px', color: '#4d534d', mt: 1.25 }}>Note: {r.note}</Typography>}
      {r.voided && <Typography sx={{ fontSize: '12.5px', color: '#9b2a22', mt: 1.25, fontWeight: 600 }}>Voided: {r.voidReason}</Typography>}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, mt: 4 }}>
        <Box sx={{ borderTop: `1px solid ${ink}`, pt: 0.5 }}><Typography sx={{ fontSize: '11px', color: '#646b64' }}>Received by · {r.recordedByName}</Typography></Box>
        <Box sx={{ borderTop: `1px solid ${ink}`, pt: 0.5 }}><Typography sx={{ fontSize: '11px', color: '#646b64' }}>Signature / stamp</Typography></Box>
      </Box>
    </Box>
  )
}

/** A printable fee statement for one student and term. */
export function StatementSheet({ statement: s }: { statement: Statement }) {
  const rows: [string, string, boolean?][] = [
    ...s.items.map((i): [string, string] => [i.name, naira(i.amount)]),
    ...(s.discount ? [[`Less: ${s.discount.reason || 'Discount'}`, `−${naira(s.discount.amount)}`] as [string, string]] : []),
  ]
  return (
    <Box sx={{ color: ink, maxWidth: 640, mx: 'auto' }}>
      <SchoolHeader school={s.school} title={`FEE STATEMENT · ${TERM_LABEL[s.term].toUpperCase()} ${s.session}`} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.25, mb: 2 }}>
        <Field k="Student" v={`${s.student.firstName} ${s.student.lastName}`} />
        <Field k="Admission no." v={s.student.admissionNumber || '–'} />
        <Field k="Class" v={s.student.className ?? '–'} />
      </Box>
      {!s.feesSet ? (
        <Typography sx={{ fontSize: '13.5px', color: '#4d534d' }}>Fees for this class haven't been set for this term.</Typography>
      ) : (
        <>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', '& td, & th': { fontSize: '13px', py: 0.7, borderBottom: `1px solid ${line}`, fontVariantNumeric: 'tabular-nums', textAlign: 'left' }, '& td:last-child, & th:last-child': { textAlign: 'right' } }}>
            <thead><tr><th style={{ ...label, borderBottom: `1.5px solid ${ink}` }}>Fees</th><th style={{ ...label, borderBottom: `1.5px solid ${ink}` }}>Amount</th></tr></thead>
            <tbody>
              {rows.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
              <tr><td style={{ fontWeight: 700 }}>Total due{s.dueDate ? ` (by ${longDate(s.dueDate)})` : ''}</td><td style={{ fontWeight: 800 }}>{naira(s.due)}</td></tr>
            </tbody>
          </Box>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', mt: 2, '& td, & th': { fontSize: '13px', py: 0.7, borderBottom: `1px solid ${line}`, fontVariantNumeric: 'tabular-nums', textAlign: 'left' }, '& td:last-child, & th:last-child': { textAlign: 'right' } }}>
            <thead><tr>{['Date', 'Receipt', 'Method', 'Amount'].map((h) => <th key={h} style={{ ...label, borderBottom: `1.5px solid ${ink}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {s.payments.length === 0 && <tr><td colSpan={4} style={{ color: '#646b64' }}>No payments yet</td></tr>}
              {s.payments.map((p) => (
                <tr key={p.id} style={{ color: p.voided ? '#9b9b93' : undefined, textDecoration: p.voided ? 'line-through' : undefined }}>
                  <td>{longDate(p.paidOn)}</td><td>{p.receiptNumber}{p.voided ? ' (void)' : ''}</td><td>{METHOD_LABEL[p.method]}</td><td>{naira(p.amount)}</td>
                </tr>
              ))}
              <tr><td colSpan={3} style={{ fontWeight: 700 }}>Total paid</td><td style={{ fontWeight: 800 }}>{naira(s.paid)}</td></tr>
            </tbody>
          </Box>
          <Box sx={{ border: `1.5px solid ${ink}`, borderRadius: '6px', p: 1.25, mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography sx={{ ...label, fontSize: '12px' }}>Balance</Typography>
            <Typography sx={{ fontSize: '20px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{s.balance > 0 ? naira(s.balance) : 'Fully paid'}</Typography>
          </Box>
        </>
      )}
      <Typography sx={{ fontSize: '11px', color: '#646b64', mt: 2, textAlign: 'center' }}>Printed {longDate(schoolToday())}</Typography>
    </Box>
  )
}

interface StudentOption { id: string; firstName: string; lastName: string; admissionNumber: string; classId?: string; status?: string }

/** Record a payment: pick the student, see what they owe, enter the amount. Shows the receipt when done. */
export function RecordPaymentDialog({ open, onClose, onRecorded, term, session, studentId: presetStudent }: {
  open: boolean
  onClose: () => void
  onRecorded: (r: Receipt) => void
  term: Term
  session: string
  studentId?: string
}) {
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const [students, setStudents] = useState<StudentOption[]>([])
  const [classNames, setClassNames] = useState<Map<string, string>>(new Map())
  const [studentId, setStudentId] = useState('')
  const [statement, setStatement] = useState<Statement | null>(null)
  const [loadingStatement, setLoadingStatement] = useState(false)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<Method>('TRANSFER')
  const [paidOn, setPaidOn] = useState(schoolToday())
  const [reference, setReference] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setStudentId(presetStudent ?? '')
    setAmount('')
    setReference('')
    setPaidOn(schoolToday())
    setError('')
    setStatement(null)
    api.get('/students').then((r) => setStudents(r.data.data.filter((s: StudentOption) => s.status !== 'INACTIVE'))).catch(() => {})
    api.get('/classes').then((r) => setClassNames(new Map(r.data.data.map((c: { id: string; name: string }) => [c.id, c.name])))).catch(() => {})
  }, [open, presetStudent])

  useEffect(() => {
    if (!open || !studentId) { setStatement(null); return }
    setLoadingStatement(true)
    getStatement(studentId, term, session)
      .then(setStatement)
      .catch((err) => setError(errorText(err, 'Failed to load fees')))
      .finally(() => setLoadingStatement(false))
  }, [open, studentId, term, session])

  const options = useMemo(() => [...students].sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)), [students])
  const value = parseNaira(amount)
  const tooMuch = !!statement && value !== null && value > statement.balance
  const canSave = !!statement && statement.feesSet && statement.balance > 0 && value !== null && value > 0 && !tooMuch && !!paidOn && !saving

  const save = async () => {
    if (!statement || value === null) return
    setSaving(true)
    setError('')
    try {
      onRecorded(await recordPayment({ studentId, term, session, amount: value, method, paidOn, reference: reference.trim() || undefined }))
    } catch (err) {
      setError(errorText(err, 'Failed to record the payment'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isPhone}>
      <DialogTitle sx={{ fontWeight: 700 }}>Record payment · {TERM_LABEL[term]} {session}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Autocomplete
            options={options}
            value={options.find((s) => s.id === studentId) ?? null}
            onChange={(_, s) => { setStudentId(s?.id ?? ''); setAmount('') }}
            getOptionLabel={(s) => `${s.firstName} ${s.lastName}`}
            filterOptions={(opts, { inputValue }) => {
              const q = inputValue.trim().toLowerCase()
              return opts.filter((s) => `${s.firstName} ${s.lastName} ${s.admissionNumber}`.toLowerCase().includes(q)).slice(0, 50)
            }}
            renderOption={(props, s) => (
              <li {...props} key={s.id}>
                <Box>
                  <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>{s.firstName} {s.lastName}</Typography>
                  <Typography sx={{ fontSize: '12px', color: brand.subtle }}>{[s.admissionNumber, s.classId ? classNames.get(s.classId) : null].filter(Boolean).join(' · ')}</Typography>
                </Box>
              </li>
            )}
            renderInput={(params) => <TextField {...params} label="Student" placeholder="Search by name or admission number" autoFocus={!presetStudent} />}
          />

          {loadingStatement && <Box sx={{ display: 'flex', justifyContent: 'center', py: 1 }}><CircularProgress size={22} /></Box>}
          {statement && !loadingStatement && (
            !statement.feesSet ? (
              <Alert severity="info">Fees for {statement.student.className ?? "this student's class"} haven't been set for this term. Set them on the Fees page first.</Alert>
            ) : (
              <Box sx={{ border: `1px solid ${brand.border}`, borderRadius: '10px', p: 1.5, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1, bgcolor: '#fbfaf6' }}>
                {[['Due', statement.due], ['Paid', statement.paid], ['Balance', statement.balance]].map(([k, v]) => (
                  <Box key={k as string}>
                    <Typography sx={{ fontSize: '12px', color: brand.muted }}>{k}</Typography>
                    <Typography sx={{ fontSize: '16px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: k === 'Balance' && (v as number) > 0 ? '#9b2a22' : brand.text }}>{naira(v as number)}</Typography>
                  </Box>
                ))}
              </Box>
            )
          )}

          {statement?.feesSet && statement.balance > 0 && (
            <>
              <Stack direction="row" spacing={1.5}>
                <TextField label="Amount (₦)" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ''))} inputProps={{ inputMode: 'numeric' }} fullWidth
                  error={tooMuch || (amount !== '' && value === null)}
                  helperText={tooMuch ? `Balance is ${naira(statement.balance)}` : value ? naira(value) : ' '} />
                <TextField select label="Method" value={method} onChange={(e) => setMethod(e.target.value as Method)} helperText=" " fullWidth>
                  {METHODS.map((m) => <MenuItem key={m} value={m}>{METHOD_LABEL[m]}</MenuItem>)}
                </TextField>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button size="small" variant="outlined" onClick={() => setAmount(statement.balance.toLocaleString('en-NG'))}>Pay full balance</Button>
                {statement.balance >= 2 && <Button size="small" variant="outlined" onClick={() => setAmount(Math.ceil(statement.balance / 2).toLocaleString('en-NG'))}>Half</Button>}
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <TextField type="date" label="Date paid" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ max: schoolToday() }} fullWidth />
                <TextField label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} inputProps={{ maxLength: 60 }} placeholder="Teller or transfer ref" fullWidth />
              </Stack>
            </>
          )}
          {statement?.feesSet && statement.balance <= 0 && <Alert severity="success">{statement.student.firstName} has paid in full for this term.</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!canSave}>{saving ? 'Saving…' : value ? `Record ${naira(value)}` : 'Record payment'}</Button>
      </DialogActions>
    </Dialog>
  )
}

/** Shows a receipt with Print, and optionally Void. */
export function ReceiptDialog({ receipt, onClose, onVoid }: { receipt: Receipt | null; onClose: () => void; onVoid?: (reason: string) => Promise<void> }) {
  const { printing, print } = usePrint()
  const [voiding, setVoiding] = useState(false)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { setVoiding(false); setReason(''); setError('') }, [receipt?.id])
  if (!receipt) return null
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <ReceiptSheet receipt={receipt} />
        {voiding && (
          <TextField label="Why is this payment being voided?" value={reason} onChange={(e) => setReason(e.target.value)} fullWidth multiline minRows={2} sx={{ mt: 2.5 }}
            inputProps={{ maxLength: 200 }} helperText="The receipt is kept and marked void. Its amount stops counting." autoFocus />
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'space-between' }}>
        <Box>
          {onVoid && !receipt.voided && (voiding ? (
            <Button color="error" variant="contained" disabled={!reason.trim()} onClick={async () => {
              try { await onVoid(reason.trim()) } catch (err) { setError(errorText(err, 'Failed to void the payment')) }
            }}>Void payment</Button>
          ) : (
            <Button color="error" onClick={() => setVoiding(true)}>Void…</Button>
          ))}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Close</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={print}>Print receipt</Button>
        </Stack>
      </DialogActions>
      <PrintArea active={printing} size="A5"><ReceiptSheet receipt={receipt} /></PrintArea>
    </Dialog>
  )
}

/** A student's statement for the term, with discount editing and a shortcut to record a payment. */
export function StatementDialog({ studentId, term, session, onClose, onChanged, onRecordPayment }: {
  studentId: string | null
  term: Term
  session: string
  onClose: () => void
  onChanged: () => void
  onRecordPayment: (studentId: string) => void
}) {
  const { printing, print } = usePrint()
  const [statement, setStatement] = useState<Statement | null>(null)
  const [editingDiscount, setEditingDiscount] = useState(false)
  const [discount, setDiscount] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const load = () => {
    if (!studentId) return
    getStatement(studentId, term, session).then((s) => {
      setStatement(s)
      setDiscount(s.discount ? s.discount.amount.toLocaleString('en-NG') : '')
      setReason(s.discount?.reason ?? '')
    }).catch((err) => setError(errorText(err, 'Failed to load the statement')))
  }
  useEffect(() => { setStatement(null); setEditingDiscount(false); setError(''); load() }, [studentId, term, session]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!studentId) return null
  const value = discount.trim() === '' ? 0 : parseNaira(discount)
  const saveDisc = async () => {
    if (value === null) return
    setError('')
    try {
      await saveDiscount({ term, session, studentId, amount: value, reason: reason.trim() || undefined })
      setEditingDiscount(false)
      load()
      onChanged()
    } catch (err) {
      setError(errorText(err, 'Failed to save the discount'))
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!statement ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={26} /></Box> : (
          <>
            <StatementSheet statement={statement} />
            {statement.feesSet && editingDiscount && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2.5 }}>
                <TextField label="Discount (₦)" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d,]/g, ''))} inputProps={{ inputMode: 'numeric' }}
                  error={value === null} helperText="Leave empty or 0 to remove" sx={{ width: { sm: 180 } }} />
                <TextField label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Sibling discount, scholarship" inputProps={{ maxLength: 100 }} helperText=" " fullWidth />
                <Stack direction="row" spacing={1} sx={{ pt: { sm: 1 } }}>
                  <Button onClick={() => setEditingDiscount(false)}>Cancel</Button>
                  <Button variant="contained" onClick={saveDisc} disabled={value === null}>Save</Button>
                </Stack>
              </Stack>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Box>
          {statement?.feesSet && !editingDiscount && <Button onClick={() => setEditingDiscount(true)}>{statement.discount ? 'Change discount' : 'Add discount'}</Button>}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Close</Button>
          <Button startIcon={<PrintIcon />} onClick={print} disabled={!statement}>Print</Button>
          {statement?.feesSet && statement.balance > 0 && <Button variant="contained" onClick={() => onRecordPayment(studentId)}>Record payment</Button>}
        </Stack>
      </DialogActions>
      {statement && <PrintArea active={printing}><StatementSheet statement={statement} /></PrintArea>}
    </Dialog>
  )
}
