import { useEffect, useMemo, useState } from 'react'
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
  LinearProgress,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { Add as AddIcon, WarningAmberRounded as ClashIcon, ChevronRight as ChevronIcon } from '@mui/icons-material'
import { api } from '../lib/api'
import { classLabels } from '../lib/classLabels'
import { schoolToday } from '../lib/attendanceApi'
import {
  ExamSeries,
  STATUS_STYLE,
  TERMS,
  TERM_LABEL,
  Term,
  countdown,
  createSeries,
  currentSession,
  currentTerm,
  listSeries,
} from '../lib/examsApi'
import { useAuthStore } from '../store/authStore'
import { brand } from '../theme'

const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL', 'VICE_PRINCIPAL']

interface ClassRow { id: string; name: string; status?: string; createdAt?: unknown }

const DURATIONS = [30, 45, 60, 90, 120, 150, 180]
const durationLabel = (m: number) => (m < 60 ? `${m} minutes` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60} ${m === 60 ? 'hour' : 'hours'}`)

export const dateRange = (start: string, end: string) => {
  const d = (iso: string, withYear: boolean) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(withYear ? { year: 'numeric' } : {}) })
  return start === end ? d(start, true) : `${d(start, start.slice(0, 4) !== end.slice(0, 4))} – ${d(end, true)}`
}

export function StatusBadge({ status }: { status: ExamSeries['status'] }) {
  const s = STATUS_STYLE[status]
  return (
    <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 999, fontSize: '12px', fontWeight: 600, bgcolor: s.bg, color: s.fg, whiteSpace: 'nowrap' }}>
      {s.label}
    </Box>
  )
}

export default function Exams() {
  const navigate = useNavigate()
  const canEdit = ADMIN_ROLES.includes(useAuthStore((s) => s.user?.role) ?? '')
  const today = schoolToday()
  const [series, setSeries] = useState<ExamSeries[] | null>(null)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    listSeries()
      .then(setSeries)
      .catch((err) => {
        setSeries([])
        setError(err.response?.data?.message || 'Failed to load exams')
      })
  }, [])

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4">Exams</Typography>
          <Typography sx={{ color: brand.muted, fontSize: '14.5px' }}>Plan each term's exams and build a clash-free timetable.</Typography>
        </Box>
        {canEdit && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)} sx={{ flexShrink: 0 }}>
            New exam
          </Button>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {!series ? (
        <Stack spacing={1.5}>{[0, 1].map((i) => <Skeleton key={i} variant="rounded" height={112} />)}</Stack>
      ) : series.length === 0 ? (
        <Paper sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '16px', fontWeight: 700, mb: 0.75 }}>No exams yet</Typography>
          <Typography sx={{ fontSize: '14px', color: brand.muted, maxWidth: 520, mx: 'auto', mb: canEdit ? 2.5 : 0 }}>
            {canEdit
              ? 'Create an exam such as "First Term Examination". A paper is made for every subject each class takes, from Class subjects. Then set the dates and times.'
              : 'When your school sets up an exam, its timetable will appear here.'}
          </Typography>
          {canEdit && <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>New exam</Button>}
        </Paper>
      ) : (
        <Stack spacing={1.5}>
          {series.map((s) => {
            const pct = s.papers ? Math.round((s.scheduled / s.papers) * 100) : 0
            return (
              <ButtonBase
                key={s.id}
                onClick={() => navigate(`/exams/${s.id}`)}
                sx={{
                  display: 'block', width: '100%', textAlign: 'left', p: { xs: 2, sm: 2.5 }, borderRadius: '14px',
                  bgcolor: brand.surface, border: `1px solid ${brand.border}`,
                  '&:hover': { borderColor: '#d6d3c9', boxShadow: '0 2px 10px rgba(20,26,21,0.04)' },
                  '&:focus-visible': { outline: `2px solid ${brand.green}`, outlineOffset: 2 },
                }}
              >
                <Stack direction="row" alignItems="center" spacing={2}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 0.25 }}>
                      <Typography sx={{ fontSize: '16px', fontWeight: 700, color: brand.text }}>{s.name}</Typography>
                      <StatusBadge status={s.status} />
                    </Stack>
                    <Typography sx={{ fontSize: '13.5px', color: brand.muted }}>
                      {dateRange(s.startDate, s.endDate)} · {countdown(s, today)}
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.75, sm: 2.5 }} alignItems={{ sm: 'center' }} sx={{ mt: 1.5 }}>
                      <Box sx={{ width: { xs: '100%', sm: 260 } }}>
                        <LinearProgress variant="determinate" value={pct} aria-label="Papers scheduled"
                          sx={{ height: 5, borderRadius: 3, bgcolor: '#efeee8', '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? brand.accent : brand.green, borderRadius: 3 } }} />
                      </Box>
                      <Typography sx={{ fontSize: '13px', color: brand.muted, fontVariantNumeric: 'tabular-nums' }}>
                        <Box component="span" sx={{ color: brand.text, fontWeight: 600 }}>{s.scheduled}</Box> of {s.papers} papers scheduled
                      </Typography>
                      {s.clashCount > 0 && (
                        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ color: '#7a4c00' }}>
                          <ClashIcon sx={{ fontSize: 16 }} />
                          <Typography sx={{ fontSize: '13px', fontWeight: 600 }}>{s.clashCount} {s.clashCount === 1 ? 'clash' : 'clashes'}</Typography>
                        </Stack>
                      )}
                    </Stack>
                  </Box>
                  <ChevronIcon sx={{ color: brand.subtle, flexShrink: 0 }} />
                </Stack>
              </ButtonBase>
            )
          })}
        </Stack>
      )}

      {canEdit && (
        <NewExamDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onCreated={(id, note) => navigate(`/exams/${id}`, { state: { note } })}
        />
      )}
    </Box>
  )
}

function NewExamDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string, note: string) => void }) {
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const session0 = currentSession()
  const firstYear = Number(session0.slice(0, 4))
  const sessions = [firstYear - 1, firstYear, firstYear + 1].map((y) => `${y}/${y + 1}`)

  const [term, setTerm] = useState<Term>(currentTerm())
  const [session, setSession] = useState(session0)
  const [name, setName] = useState('')
  const [nameEdited, setNameEdited] = useState(false)
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [chosen, setChosen] = useState<string[]>([])
  const [maxScore, setMaxScore] = useState('60')
  const [duration, setDuration] = useState(120)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const autoName = `${TERM_LABEL[term]} Examination ${session}`
  const labels = useMemo(() => classLabels(classes), [classes])
  const active = useMemo(
    () => classes.filter((c) => c.status !== 'INACTIVE').sort((a, b) => (labels.get(a.id) ?? a.name).localeCompare(labels.get(b.id) ?? b.name, undefined, { numeric: true })),
    [classes, labels],
  )

  useEffect(() => {
    if (!open) return
    setError('')
    api.get('/classes').then((res) => {
      setClasses(res.data.data)
      setChosen(res.data.data.filter((c: ClassRow) => c.status !== 'INACTIVE').map((c: ClassRow) => c.id))
    }).catch(() => setError('Failed to load classes'))
  }, [open])

  useEffect(() => {
    if (!nameEdited) setName(autoName)
  }, [autoName, nameEdited])

  const score = Number(maxScore)
  const scoreOk = Number.isInteger(score) && score >= 1 && score <= 100
  const datesOk = !!startDate && !!endDate && endDate >= startDate
  const canSave = !!name.trim() && datesOk && chosen.length > 0 && scoreOk && !saving

  const toggle = (id: string) => setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const created = await createSeries({
        term, session, name: name.trim(), startDate, endDate, classIds: chosen, defaultMaxScore: score, defaultDurationMinutes: duration,
      })
      const missing = created.classesWithoutSubjects
      const note =
        `${created.created} ${created.created === 1 ? 'paper' : 'papers'} created.` +
        (missing.length ? ` ${missing.join(', ')} ${missing.length === 1 ? 'has' : 'have'} no subjects yet. Add them in Class subjects, then use "Add missing papers".` : '')
      onCreated(created.id, note)
    } catch (err: any) {
      const msg = err.response?.data?.message
      setError(Array.isArray(msg) ? msg[0] : msg || 'Failed to create the exam')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={isPhone}>
      <DialogTitle sx={{ fontWeight: 700 }}>New exam</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={1.5}>
            <TextField select label="Term" value={term} onChange={(e) => setTerm(e.target.value as Term)} fullWidth>
              {TERMS.map((t) => <MenuItem key={t} value={t}>{TERM_LABEL[t]}</MenuItem>)}
            </TextField>
            <TextField select label="Session" value={session} onChange={(e) => setSession(e.target.value)} fullWidth>
              {sessions.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Stack>
          <TextField label="Name" value={name} inputProps={{ maxLength: 100 }}
            onChange={(e) => { setName(e.target.value); setNameEdited(true) }}
            helperText={nameEdited && name !== autoName ? <ButtonBase onClick={() => setNameEdited(false)} sx={{ fontSize: 'inherit', color: brand.green, fontWeight: 600 }}>Use “{autoName}”</ButtonBase> : ' '} />
          <Stack direction="row" spacing={1.5}>
            <TextField type="date" label="First paper" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField type="date" label="Last paper" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth
              inputProps={{ min: startDate || undefined }}
              error={!!startDate && !!endDate && endDate < startDate}
              helperText={!!startDate && !!endDate && endDate < startDate ? 'Must be on or after the first paper' : ' '} />
          </Stack>

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.5 }}>
              <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>Classes sitting this exam</Typography>
              <ButtonBase onClick={() => setChosen(chosen.length === active.length ? [] : active.map((c) => c.id))} sx={{ fontSize: '13px', color: brand.green, fontWeight: 600 }}>
                {chosen.length === active.length ? 'Clear all' : 'Select all'}
              </ButtonBase>
            </Stack>
            {active.length === 0 ? (
              <Typography sx={{ fontSize: '13.5px', color: brand.muted }}>No classes yet. Create classes first, on the Classes page.</Typography>
            ) : (
              <Grid container sx={{ border: `1px solid ${brand.border}`, borderRadius: '10px', px: 1, py: 0.5, maxHeight: 220, overflow: 'auto' }}>
                {active.map((c) => (
                  <Grid item xs={6} sm={4} key={c.id}>
                    <FormControlLabel control={<Checkbox size="small" checked={chosen.includes(c.id)} onChange={() => toggle(c.id)} />}
                      label={<Typography sx={{ fontSize: '14px' }}>{labels.get(c.id) ?? c.name}</Typography>} />
                  </Grid>
                ))}
              </Grid>
            )}
            <Typography sx={{ fontSize: '12.5px', color: brand.subtle, mt: 0.75 }}>
              A paper is created for every subject each class takes (from Class subjects).
            </Typography>
          </Box>

          <Stack direction="row" spacing={1.5}>
            <TextField label="Max score per paper" value={maxScore} onChange={(e) => setMaxScore(e.target.value.replace(/\D/g, ''))}
              inputProps={{ inputMode: 'numeric' }} error={!scoreOk} helperText={scoreOk ? 'You can change it for any paper' : 'From 1 to 100'} fullWidth />
            <TextField select label="Usual length" value={duration} onChange={(e) => setDuration(Number(e.target.value))} helperText=" " fullWidth>
              {DURATIONS.map((m) => <MenuItem key={m} value={m}>{durationLabel(m)}</MenuItem>)}
            </TextField>
          </Stack>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={!canSave}>{saving ? 'Creating…' : 'Create exam'}</Button>
      </DialogActions>
    </Dialog>
  )
}

export { DURATIONS, durationLabel }
