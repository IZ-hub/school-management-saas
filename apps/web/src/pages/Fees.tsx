import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { Add as AddIcon, Close as RemoveIcon, EditOutlined as EditIcon, Search as SearchIcon, ContentCopyOutlined as CopyIcon, PaymentsOutlined as PayIcon } from '@mui/icons-material'
import { classLabels } from '../lib/classLabels'
import { api } from '../lib/api'
import { TERM_LABEL, Term } from '../lib/examsApi'
import { ClassFees, FeeItem, FeeStatus, FeesOverview, Receipt, getOverview, naira, parseNaira, saveSchedule, deleteSchedule } from '../lib/feesApi'
import { ReceiptDialog, RecordPaymentDialog, StatementDialog, StatusBadge, TermPicker, longDate, previousTerm, useTermSession } from '../components/FeesKit'
import { brand } from '../theme'

interface ClassRow { id: string; name: string; status?: string; createdAt?: unknown }

const FILTERS: { key: 'OWING' | FeeStatus | 'ALL'; label: string }[] = [
  { key: 'OWING', label: 'Owing' },
  { key: 'UNPAID', label: 'Not paid' },
  { key: 'PART', label: 'Part paid' },
  { key: 'PAID', label: 'Paid' },
  { key: 'ALL', label: 'All' },
]

function Tile({ label, value, sub, children }: { label: string; value: string; sub?: string; children?: React.ReactNode }) {
  return (
    <Paper sx={{ p: { xs: 2, sm: 2.25 }, height: '100%' }}>
      <Typography sx={{ fontSize: '13px', color: brand.muted }}>{label}</Typography>
      <Typography sx={{ fontSize: { xs: '20px', sm: '24px' }, fontWeight: 700, letterSpacing: '-0.4px', fontVariantNumeric: 'tabular-nums', mt: 0.5 }}>{value}</Typography>
      {sub && <Typography sx={{ fontSize: '12.5px', color: brand.subtle, mt: 0.25 }}>{sub}</Typography>}
      {children}
    </Paper>
  )
}

export default function Fees() {
  const navigate = useNavigate()
  const { term, session, set, ready } = useTermSession()
  const [overview, setOverview] = useState<FeesOverview | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('OWING')
  const [editing, setEditing] = useState<{ classIds: string[]; items: FeeItem[]; dueDate: string } | null>(null)
  const [statementFor, setStatementFor] = useState<string | null>(null)
  const [payFor, setPayFor] = useState<string | undefined | null>(null)
  const [receipt, setReceipt] = useState<Receipt | null>(null)
  const [copying, setCopying] = useState(false)

  const load = useCallback(() => {
    getOverview(term, session).then(setOverview).catch((err) => setError(err.response?.data?.message || 'Failed to load fees'))
  }, [term, session])

  useEffect(() => { setOverview(null); if (ready) load() }, [load, ready])
  useEffect(() => { api.get('/classes').then((r) => setClasses(r.data.data)).catch(() => {}) }, [])

  const labels = useMemo(() => classLabels(classes), [classes])
  const className = (id: string | null) => (id ? labels.get(id) ?? classes.find((c) => c.id === id)?.name ?? '' : 'No class')

  const shown = useMemo(() => {
    if (!overview) return []
    const q = search.trim().toLowerCase()
    return overview.students.filter((s) =>
      (!classFilter || s.classId === classFilter) &&
      (filter === 'ALL' || (filter === 'OWING' ? s.balance > 0 : s.status === filter)) &&
      (!q || `${s.firstName} ${s.lastName} ${s.admissionNumber}`.toLowerCase().includes(q)),
    )
  }, [overview, search, classFilter, filter])
  const shownBalance = shown.reduce((a, s) => a + Math.max(0, s.balance), 0)

  const anyFees = !!overview?.classes.some((c) => c.scheduleId)
  const prev = previousTerm(term, session)

  const copyFromPrevious = async () => {
    setCopying(true)
    setError('')
    try {
      const old = await getOverview(prev.term, prev.session)
      const withFees = old.classes.filter((c) => c.scheduleId && overview?.classes.some((x) => x.classId === c.classId))
      if (withFees.length === 0) {
        setError(`No fees were set for ${TERM_LABEL[prev.term]} ${prev.session}.`)
        return
      }
      // Group classes with identical fee lists so each list is saved once.
      const groups = new Map<string, ClassFees[]>()
      withFees.forEach((c) => groups.set(JSON.stringify(c.items), [...(groups.get(JSON.stringify(c.items)) ?? []), c]))
      for (const list of groups.values()) await saveSchedule({ term, session, classIds: list.map((c) => c.classId), items: list[0].items })
      setNotice(`Copied fees for ${withFees.length} ${withFees.length === 1 ? 'class' : 'classes'}. Check the amounts and due dates.`)
      load()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to copy fees')
    } finally {
      setCopying(false)
    }
  }

  const t = overview?.totals
  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4">Fees</Typography>
          <Typography sx={{ color: brand.muted, fontSize: '14.5px' }}>Set each class's fees for the term and see who still owes.</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TermPicker term={term} session={session} onChange={set} />
          <Button variant="contained" startIcon={<PayIcon />} onClick={() => setPayFor(undefined)} disabled={!anyFees}>Record payment</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {!overview || !t ? (
        <Grid container spacing={2}>{[0, 1, 2, 3].map((i) => <Grid item xs={6} md={3} key={i}><Skeleton variant="rounded" height={104} /></Grid>)}</Grid>
      ) : (
        <>
          <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: 2 }}>
            <Grid item xs={6} md={3}><Tile label="Expected" value={naira(t.expected)} sub={t.discounts ? `After ${naira(t.discounts)} discounts` : `${TERM_LABEL[term]} ${session}`} /></Grid>
            <Grid item xs={6} md={3}>
              <Tile label="Collected" value={naira(t.collected)}>
                <LinearProgress variant="determinate" value={Math.min(100, t.rate ?? 0)} aria-label="Collected"
                  sx={{ mt: 1, height: 5, borderRadius: 3, bgcolor: '#efeee8', '& .MuiLinearProgress-bar': { bgcolor: brand.accent, borderRadius: 3 } }} />
                <Typography sx={{ fontSize: '12.5px', color: brand.subtle, mt: 0.5 }}>{t.rate ?? 0}% of expected</Typography>
              </Tile>
            </Grid>
            <Grid item xs={6} md={3}><Tile label="Outstanding" value={naira(t.outstanding)} sub={`${t.owing} ${t.owing === 1 ? 'student' : 'students'} owing`} /></Grid>
            <Grid item xs={6} md={3}><Tile label="Paid in full" value={String(t.paidInFull)} sub={`of ${overview.students.filter((s) => s.status !== 'NO_FEES').length} students with fees`} /></Grid>
          </Grid>

          {/* Fees by class */}
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 1.5 }}>
              <Typography component="h2" sx={{ fontSize: '15px', fontWeight: 700 }}>Fees by class · {TERM_LABEL[term]} {session}</Typography>
              <Stack direction="row" spacing={1}>
                {!anyFees && overview.classes.length > 0 && (
                  <Button size="small" startIcon={<CopyIcon />} onClick={copyFromPrevious} disabled={copying}>
                    {copying ? 'Copying…' : `Copy from ${TERM_LABEL[prev.term]} ${prev.session}`}
                  </Button>
                )}
                <Button size="small" variant="outlined" startIcon={<AddIcon />} disabled={overview.classes.length === 0}
                  onClick={() => setEditing({ classIds: overview.classes.filter((c) => !c.scheduleId).map((c) => c.classId), items: [{ name: 'Tuition', amount: 0 }], dueDate: '' })}>
                  Set fees
                </Button>
              </Stack>
            </Stack>
            {overview.classes.length === 0 ? (
              <Typography sx={{ fontSize: '14px', color: brand.muted }}>Create your classes first, on the Classes page.</Typography>
            ) : (
              <Box sx={{ border: `1px solid ${brand.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                {overview.classes.map((c, i) => {
                  const pct = c.expected ? Math.round((c.collected / c.expected) * 100) : 0
                  return (
                    <Stack key={c.classId} direction="row" alignItems="center" spacing={2} sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, borderTop: i ? `1px solid ${brand.border}` : 'none' }}>
                      <Box sx={{ width: { xs: 90, sm: 130 }, flexShrink: 0 }}>
                        <Typography sx={{ fontSize: '14.5px', fontWeight: 700 }}>{labels.get(c.classId) ?? c.name}</Typography>
                        <Typography sx={{ fontSize: '12px', color: brand.subtle }}>{c.students} {c.students === 1 ? 'student' : 'students'}</Typography>
                      </Box>
                      {c.scheduleId ? (
                        <>
                          <Box sx={{ width: { xs: 'auto', sm: 210 }, flex: { xs: 1, sm: 'none' }, minWidth: 0 }}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{naira(c.perStudent!)} <Box component="span" sx={{ fontSize: '12.5px', fontWeight: 400, color: brand.muted }}>per student</Box></Typography>
                            <Typography noWrap sx={{ fontSize: '12px', color: brand.subtle }}>{c.items.map((x) => x.name).join(' · ')}{c.dueDate ? ` · due ${longDate(c.dueDate)}` : ''}</Typography>
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0, display: { xs: 'none', sm: 'block' } }}>
                            <LinearProgress variant="determinate" value={pct} aria-label={`${c.name} collected`}
                              sx={{ height: 5, borderRadius: 3, bgcolor: '#efeee8', '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? brand.accent : brand.green, borderRadius: 3 } }} />
                            <Typography sx={{ fontSize: '12px', color: brand.muted, mt: 0.5, fontVariantNumeric: 'tabular-nums' }}>
                              {naira(c.collected)} of {naira(c.expected)} · {c.paidInFull} of {c.students} paid in full
                            </Typography>
                          </Box>
                        </>
                      ) : (
                        <Typography sx={{ flex: 1, fontSize: '13.5px', color: brand.subtle }}>No fees set</Typography>
                      )}
                      <Tooltip title={c.scheduleId ? 'Change fees' : 'Set fees'}>
                        <IconButton size="small" aria-label={`${c.scheduleId ? 'Change' : 'Set'} fees for ${c.name}`} sx={{ color: brand.subtle }}
                          onClick={() => setEditing({ classIds: [c.classId], items: c.items.length ? c.items : [{ name: 'Tuition', amount: 0 }], dueDate: c.dueDate ?? '' })}>
                          {c.scheduleId ? <EditIcon sx={{ fontSize: 18 }} /> : <AddIcon sx={{ fontSize: 18 }} />}
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  )
                })}
              </Box>
            )}
          </Paper>

          {/* Students */}
          <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ md: 'center' }} sx={{ mb: 1.5 }}>
              <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                {FILTERS.map((f) => {
                  const n = f.key === 'ALL' ? overview.students.length : f.key === 'OWING' ? overview.students.filter((s) => s.balance > 0).length : overview.students.filter((s) => s.status === f.key).length
                  const on = filter === f.key
                  return (
                    <ButtonBase key={f.key} onClick={() => setFilter(f.key)} aria-pressed={on}
                      sx={{ px: 1.25, py: 0.6, borderRadius: 999, fontSize: '13px', fontWeight: 600, border: `1px solid ${on ? brand.green : brand.border}`, bgcolor: on ? brand.greenSoft : brand.surface, color: on ? brand.green : brand.muted }}>
                      {f.label} <Box component="span" sx={{ ml: 0.5, fontVariantNumeric: 'tabular-nums', color: brand.subtle }}>{n}</Box>
                    </ButtonBase>
                  )
                })}
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <TextField size="small" placeholder="Search students" value={search} onChange={(e) => setSearch(e.target.value)}
                  InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: brand.subtle }} /></InputAdornment> }} sx={{ width: { sm: 220 } }} />
                <TextField select size="small" value={classFilter} onChange={(e) => setClassFilter(e.target.value)} SelectProps={{ displayEmpty: true }} sx={{ width: { sm: 160 } }}>
                  <MenuItem value="">All classes</MenuItem>
                  {overview.classes.map((c) => <MenuItem key={c.classId} value={c.classId}>{labels.get(c.classId) ?? c.name}</MenuItem>)}
                </TextField>
              </Stack>
            </Stack>

            {shown.length === 0 ? (
              <Typography sx={{ color: brand.muted, fontSize: '14px', py: 3, textAlign: 'center' }}>
                {!anyFees ? 'Set fees for your classes to see what each student owes.' : filter === 'OWING' && !search && !classFilter ? 'Nobody owes anything for this term.' : 'No students match.'}
              </Typography>
            ) : (
              <>
                <Typography sx={{ fontSize: '12.5px', color: brand.muted, mb: 1 }}>
                  {shown.length} {shown.length === 1 ? 'student' : 'students'}{shownBalance ? ` · ${naira(shownBalance)} outstanding` : ''}
                </Typography>
                <Box role="list" sx={{ border: `1px solid ${brand.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                  {shown.slice(0, 300).map((s, i) => (
                    <ButtonBase key={s.id} role="listitem" onClick={() => setStatementFor(s.id)}
                      sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2, px: { xs: 1.5, sm: 2 }, py: 1.1, textAlign: 'left', borderTop: i ? `1px solid ${brand.border}` : 'none', '&:hover': { bgcolor: '#fbfaf7' } }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography noWrap sx={{ fontSize: '14.5px', fontWeight: 600 }}>{s.firstName} {s.lastName}</Typography>
                        <Typography noWrap sx={{ fontSize: '12px', color: brand.subtle }}>{[className(s.classId), s.admissionNumber].filter(Boolean).join(' · ')}</Typography>
                      </Box>
                      <Box sx={{ display: { xs: 'none', sm: 'block' }, width: 120, textAlign: 'right' }}>
                        <Typography sx={{ fontSize: '12px', color: brand.subtle }}>Paid</Typography>
                        <Typography sx={{ fontSize: '13.5px', fontVariantNumeric: 'tabular-nums' }}>{naira(s.paid)} <Box component="span" sx={{ color: brand.subtle }}>/ {naira(s.due)}</Box></Typography>
                      </Box>
                      <Box sx={{ width: { xs: 96, sm: 120 }, textAlign: 'right' }}>
                        <Typography sx={{ fontSize: '12px', color: brand.subtle }}>Balance</Typography>
                        <Typography sx={{ fontSize: '14.5px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: s.balance > 0 ? '#9b2a22' : brand.text }}>{naira(Math.max(0, s.balance))}</Typography>
                      </Box>
                      <Box sx={{ width: 92, display: { xs: 'none', md: 'flex' }, justifyContent: 'flex-end' }}><StatusBadge status={s.status} /></Box>
                    </ButtonBase>
                  ))}
                </Box>
                {shown.length > 300 && <Typography sx={{ fontSize: '12.5px', color: brand.subtle, mt: 1 }}>Showing the first 300. Search or filter by class to narrow it down.</Typography>}
              </>
            )}
          </Paper>
        </>
      )}

      {editing && overview && (
        <SetFeesDialog
          initial={editing}
          classes={overview.classes.map((c) => ({ id: c.classId, name: labels.get(c.classId) ?? c.name, hasFees: !!c.scheduleId }))}
          term={term}
          session={session}
          onClose={() => setEditing(null)}
          onSaved={(n) => { setEditing(null); setNotice(`Fees saved for ${n} ${n === 1 ? 'class' : 'classes'}`); load() }}
          onDeleted={() => { setEditing(null); setNotice('Fees removed'); load() }}
          scheduleId={editing.classIds.length === 1 ? overview.classes.find((c) => c.classId === editing.classIds[0])?.scheduleId ?? null : null}
        />
      )}

      <StatementDialog studentId={statementFor} term={term} session={session} onClose={() => setStatementFor(null)} onChanged={load}
        onRecordPayment={(id) => { setStatementFor(null); setPayFor(id) }} />

      <RecordPaymentDialog open={payFor !== null} studentId={payFor ?? undefined} term={term} session={session} onClose={() => setPayFor(null)}
        onRecorded={(r) => { setPayFor(null); setReceipt(r); load() }} />

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />

      <Snackbar open={!!notice} autoHideDuration={3500} onClose={() => setNotice('')} message={notice}
        action={notice.startsWith('Fees saved') ? <Button size="small" onClick={() => navigate('/payments')} sx={{ color: brand.accent }}>Payments</Button> : undefined} />
    </Box>
  )
}

function SetFeesDialog({ initial, classes, term, session, scheduleId, onClose, onSaved, onDeleted }: {
  initial: { classIds: string[]; items: FeeItem[]; dueDate: string }
  classes: { id: string; name: string; hasFees: boolean }[]
  term: Term
  session: string
  scheduleId: string | null
  onClose: () => void
  onSaved: (n: number) => void
  onDeleted: () => void
}) {
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const [chosen, setChosen] = useState<string[]>(initial.classIds)
  const [items, setItems] = useState(initial.items.map((i) => ({ name: i.name, amount: i.amount ? i.amount.toLocaleString('en-NG') : '' })))
  const [dueDate, setDueDate] = useState(initial.dueDate)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const parsed = items.map((i) => ({ name: i.name.trim(), amount: parseNaira(i.amount) }))
  const total = parsed.reduce((a, i) => a + (i.amount ?? 0), 0)
  const valid = chosen.length > 0 && parsed.length > 0 && parsed.every((i) => i.name && i.amount !== null) && total > 0
  const replacing = classes.filter((c) => chosen.includes(c.id) && c.hasFees)

  const setItem = (idx: number, key: 'name' | 'amount', v: string) => setItems((list) => list.map((x, i) => (i === idx ? { ...x, [key]: v } : x)))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const res = await saveSchedule({ term, session, classIds: chosen, items: parsed.map((i) => ({ name: i.name, amount: i.amount! })), ...(dueDate ? { dueDate } : {}) })
      onSaved(res.saved)
    } catch (err: any) {
      const msg = err.response?.data?.message
      setError(Array.isArray(msg) ? msg[0] : msg || 'Failed to save fees')
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!scheduleId || !window.confirm('Remove the fees for this class for the term?')) return
    try {
      await deleteSchedule(scheduleId)
      onDeleted()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove fees')
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth fullScreen={isPhone}>
      <DialogTitle sx={{ fontWeight: 700 }}>Fees · {TERM_LABEL[term]} {session}</DialogTitle>
      <DialogContent>
        <Stack spacing={2.25} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
              <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>Classes</Typography>
              <ButtonBase onClick={() => setChosen(chosen.length === classes.length ? [] : classes.map((c) => c.id))} sx={{ fontSize: '13px', color: brand.green, fontWeight: 600 }}>
                {chosen.length === classes.length ? 'Clear all' : 'Select all'}
              </ButtonBase>
            </Stack>
            <Grid container sx={{ border: `1px solid ${brand.border}`, borderRadius: '10px', px: 1, py: 0.5, maxHeight: 180, overflow: 'auto' }}>
              {classes.map((c) => (
                <Grid item xs={6} sm={4} key={c.id}>
                  <FormControlLabel control={<Checkbox size="small" checked={chosen.includes(c.id)} onChange={() => setChosen((x) => (x.includes(c.id) ? x.filter((y) => y !== c.id) : [...x, c.id]))} />}
                    label={<Typography sx={{ fontSize: '14px' }}>{c.name}{c.hasFees ? <Box component="span" sx={{ color: brand.subtle, fontSize: '12px' }}> · set</Box> : ''}</Typography>} />
                </Grid>
              ))}
            </Grid>
            {replacing.length > 0 && (
              <Typography sx={{ fontSize: '12.5px', color: '#7a4c00', mt: 0.75 }}>
                This replaces the fees already set for {replacing.map((c) => c.name).join(', ')}. Payments already recorded are kept.
              </Typography>
            )}
          </Box>

          <Box>
            <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 1 }}>Fee items (per student)</Typography>
            <Stack spacing={1}>
              {items.map((it, idx) => (
                <Stack key={idx} direction="row" spacing={1} alignItems="center">
                  <TextField size="small" placeholder="e.g. Tuition" value={it.name} onChange={(e) => setItem(idx, 'name', e.target.value)} inputProps={{ maxLength: 60, 'aria-label': `Item ${idx + 1} name` }} sx={{ flex: 1 }} />
                  <TextField size="small" placeholder="0" value={it.amount} onChange={(e) => setItem(idx, 'amount', e.target.value.replace(/[^\d,]/g, ''))}
                    inputProps={{ inputMode: 'numeric', 'aria-label': `Item ${idx + 1} amount` }} InputProps={{ startAdornment: <InputAdornment position="start">₦</InputAdornment> }}
                    error={it.amount !== '' && parseNaira(it.amount) === null} sx={{ width: { xs: 130, sm: 170 } }} />
                  <IconButton size="small" aria-label={`Remove item ${idx + 1}`} disabled={items.length === 1} onClick={() => setItems((l) => l.filter((_, i) => i !== idx))}>
                    <RemoveIcon sx={{ fontSize: 18 }} />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 1 }}>
              <Button size="small" startIcon={<AddIcon />} onClick={() => setItems((l) => [...l, { name: '', amount: '' }])} disabled={items.length >= 20}>Add item</Button>
              <Typography sx={{ fontSize: '14px' }}>Total <Box component="span" sx={{ fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{naira(total)}</Box></Typography>
            </Stack>
            {chosen.length > 0 && total > 0 && (
              <Typography sx={{ fontSize: '12.5px', color: brand.subtle, textAlign: 'right' }}>
                Per student, across {chosen.length} {chosen.length === 1 ? 'class' : 'classes'}
              </Typography>
            )}
          </Box>

          <TextField type="date" label="Due date (optional)" value={dueDate} onChange={(e) => setDueDate(e.target.value)} InputLabelProps={{ shrink: true }} sx={{ width: 220 }} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'space-between' }}>
        <Box>{scheduleId && <Button color="error" onClick={remove}>Remove fees</Button>}</Box>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" onClick={save} disabled={!valid || saving}>{saving ? 'Saving…' : 'Save fees'}</Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}
