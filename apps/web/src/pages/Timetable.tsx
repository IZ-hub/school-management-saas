import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { PrintOutlined as PrintIcon, TuneOutlined as SetupIcon, WarningAmberRounded as ClashIcon, Close as RemoveIcon, Add as AddIcon } from '@mui/icons-material'
import { api } from '../lib/api'
import { classLabels } from '../lib/classLabels'
import { ClassWeek, DAYS, DAY_LABEL, Day, Lesson, Period, Setup, TeacherWeek, getClassWeek, getMyWeek, getOverview, getTeacherWeek, saveSetup, setSlot, shortTime } from '../lib/timetableApi'
import { PrintArea, usePrint } from '../components/FeesKit'
import { ADMIN_ROLES } from '../lib/roles'
import { useAuthStore } from '../store/authStore'
import { brand } from '../theme'

interface ClassRow { id: string; name: string; status?: string; createdAt?: unknown }
interface TeacherRow { id: string; firstName: string; lastName: string; status?: string }

const amber = { bg: '#fdf0d5', fg: '#7a4c00', border: '#efc777' }
const errorText = (err: any, fallback: string) => {
  const msg = err?.response?.data?.message
  return Array.isArray(msg) ? msg[0] : msg || fallback
}

/** The week grid: periods down the side, days across. Breaks span the whole row. */
function WeekGrid({ setup, lessons, show, onCell, compact }: {
  setup: Setup
  lessons: Lesson[]
  show: 'teacher' | 'class'
  onCell?: (day: Day, period: Period, el: HTMLElement) => void
  compact?: boolean
}) {
  const at = (day: Day, periodId: string) => lessons.filter((l) => l.day === day && l.periodId === periodId)
  return (
    <Box sx={{ overflowX: 'auto' }}>
      <Box component="table" sx={{ width: '100%', minWidth: 120 + setup.days.length * 120, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', '& td, & th': { borderBottom: `1px solid ${brand.border}`, borderRight: `1px solid ${brand.border}` } }}>
        <thead>
          <tr>
            <Box component="th" sx={{ width: 110, p: 1, textAlign: 'left', fontSize: '12px', color: brand.muted, fontWeight: 600, borderTop: `1px solid ${brand.border}`, borderLeft: `1px solid ${brand.border}`, borderTopLeftRadius: '10px' }}>Time</Box>
            {setup.days.map((d, i) => (
              <Box component="th" key={d} sx={{ p: 1, fontSize: '13px', fontWeight: 700, borderTop: `1px solid ${brand.border}`, ...(i === setup.days.length - 1 ? { borderTopRightRadius: '10px' } : {}) }}>{compact ? d.charAt(0) + d.slice(1).toLowerCase() : DAY_LABEL[d]}</Box>
            ))}
          </tr>
        </thead>
        <tbody>
          {setup.periods.map((p) => (
            <tr key={p.id}>
              <Box component="td" sx={{ p: 1, borderLeft: `1px solid ${brand.border}`, verticalAlign: 'top' }}>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600 }}>{p.label}</Typography>
                <Typography sx={{ fontSize: '11.5px', color: brand.subtle, fontVariantNumeric: 'tabular-nums' }}>{shortTime(p.start)}–{shortTime(p.end)}</Typography>
              </Box>
              {p.kind === 'BREAK' ? (
                <Box component="td" colSpan={setup.days.length} sx={{ bgcolor: '#f7f6f1', textAlign: 'center', fontSize: '12px', color: brand.muted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{p.label}</Box>
              ) : setup.days.map((d) => {
                const here = at(d, p.id)
                const clash = here.some((l) => l.clash)
                const content = here.length === 0 ? (
                  onCell ? <Typography sx={{ fontSize: '12px', color: '#c9c7bd' }}>+</Typography> : null
                ) : here.map((l) => (
                  <Box key={`${l.classId}${l.subjectId}`}>
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.25 }}>{l.subject}</Typography>
                    <Typography sx={{ fontSize: '11.5px', color: brand.muted, lineHeight: 1.3 }}>{show === 'teacher' ? l.teacherName ?? 'No teacher' : l.className}</Typography>
                  </Box>
                ))
                return (
                  <Box component="td" key={d} sx={{ p: 0, verticalAlign: 'top', bgcolor: clash ? '#fffaf0' : brand.surface, boxShadow: clash ? `inset 3px 0 0 ${amber.border}` : 'none' }}>
                    {onCell ? (
                      <ButtonBase onClick={(e) => onCell(d, p, e.currentTarget)} aria-label={`${DAY_LABEL[d]} ${p.label}${here[0] ? `: ${here[0].subject}` : ': empty'}`}
                        sx={{ width: '100%', minHeight: 52, p: 1, display: 'block', textAlign: 'left', '&:hover': { bgcolor: clash ? '#fff4dc' : '#f7faf6' } }}>
                        {content}
                      </ButtonBase>
                    ) : <Box sx={{ minHeight: 44, p: 1 }}>{content}</Box>}
                  </Box>
                )
              })}
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  )
}

export default function Timetable() {
  const role = useAuthStore((s) => s.user?.role) ?? ''
  const isAdmin = ADMIN_ROLES.includes(role)
  const isTeacher = role === 'TEACHER'
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as 'class' | 'teacher' | 'mine') || (isTeacher ? 'mine' : 'class')
  const classId = params.get('class') ?? ''
  const teacherId = params.get('teacher') ?? ''
  const setParam = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
  }

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [classesLoaded, setClassesLoaded] = useState(false)
  const navigate = useNavigate()
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getOverview>> | null>(null)
  const [classWeek, setClassWeek] = useState<ClassWeek | null>(null)
  const [teacherWeek, setTeacherWeek] = useState<TeacherWeek | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [picker, setPicker] = useState<{ el: HTMLElement; day: Day; period: Period } | null>(null)
  const [setupOpen, setSetupOpen] = useState(false)
  const { printing, print } = usePrint()

  const labels = useMemo(() => classLabels(classes), [classes])
  const activeClasses = useMemo(() => classes.filter((c) => c.status !== 'INACTIVE').sort((a, b) => (labels.get(a.id) ?? a.name).localeCompare(labels.get(b.id) ?? b.name, undefined, { numeric: true })), [classes, labels])

  const loadOverview = useCallback(() => { getOverview().then(setOverview).catch(() => {}) }, [])
  useEffect(() => {
    api.get('/classes')
      .then((r) => setClasses(r.data.data))
      .catch((err) => setError(errorText(err, "We couldn't load your classes. Refresh the page to try again.")))
      .finally(() => setClassesLoaded(true))
    api.get('/teachers').then((r) => setTeachers(r.data.data.filter((t: TeacherRow) => t.status !== 'INACTIVE'))).catch(() => {})
    loadOverview()
  }, [loadOverview])

  // Pick the first class by default, or when the chosen class no longer exists.
  useEffect(() => {
    if (view !== 'class' || !classesLoaded || !activeClasses[0]) return
    if (!classId || !activeClasses.some((c) => c.id === classId)) setParam({ class: activeClasses[0].id })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, classId, activeClasses, classesLoaded])

  const loadWeek = useCallback(() => {
    setError('')
    if (view === 'class' && classId) getClassWeek(classId).then(setClassWeek).catch((err) => setError(errorText(err, 'Failed to load the timetable')))
    if (view === 'teacher' && teacherId) getTeacherWeek(teacherId).then(setTeacherWeek).catch((err) => setError(errorText(err, 'Failed to load the timetable')))
    if (view === 'mine') getMyWeek().then(setTeacherWeek).catch((err) => { setTeacherWeek(null); setError(errorText(err, 'Failed to load your timetable')) })
  }, [view, classId, teacherId])
  useEffect(() => { setClassWeek(null); setTeacherWeek(null); loadWeek() }, [loadWeek])

  const place = async (subjectId: string | null) => {
    if (!picker || !classWeek) return
    const { day, period } = picker
    setPicker(null)
    try {
      const res = await setSlot(classWeek.class.id, day, period.id, subjectId)
      if (res.clash) setNotice(`Clash: ${res.clash.teacherName ?? 'This teacher'} also has ${res.clash.lessons.filter((l) => l.classId !== classWeek.class.id).map((l) => l.className).join(', ')} then.`)
      loadWeek()
      loadOverview()
    } catch (err) {
      setError(errorText(err, 'Failed to save'))
    }
  }

  const currentClassLesson = picker && classWeek ? classWeek.lessons.find((l) => l.day === picker.day && l.periodId === picker.period.id) : undefined
  const week = view === 'class' ? classWeek : teacherWeek
  const title = view === 'class' ? classWeek ? `${labels.get(classWeek.class.id) ?? classWeek.class.name} timetable` : '' : teacherWeek ? `${teacherWeek.teacher.name}'s timetable` : ''

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1240, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4">Timetable</Typography>
          <Typography sx={{ color: brand.muted, fontSize: '14.5px' }}>
            {isAdmin ? "Click a period to place a subject. Teachers come from Class subjects, and clashes are flagged." : 'Weekly lessons for each class and teacher.'}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {isAdmin && <Button startIcon={<SetupIcon />} onClick={() => setSetupOpen(true)}>Periods</Button>}
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={print} disabled={!week}>Print</Button>
        </Stack>
      </Stack>

      {overview && overview.clashes.length > 0 && (
        <Box sx={{ border: `1px solid ${amber.border}`, bgcolor: '#fffaf0', borderRadius: '12px', p: { xs: 1.5, sm: 2 }, mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, color: amber.fg }}>
            <ClashIcon sx={{ fontSize: 19 }} />
            <Typography sx={{ fontSize: '14px', fontWeight: 700 }}>{overview.clashes.length} {overview.clashes.length === 1 ? 'teacher clash' : 'teacher clashes'}</Typography>
          </Stack>
          <Box component="ul" sx={{ m: 0, pl: 3.5, '& li': { fontSize: '13.5px', py: 0.25 } }}>
            {overview.clashes.map((c) => (
              <li key={`${c.teacherId}${c.day}${c.periodId}`}>
                {c.teacherName ?? 'A teacher'} has {c.lessons.map((l) => `${l.className} ${l.subject}`).join(' and ')} on {DAY_LABEL[c.day]}, {overview.setup.periods.find((p) => p.id === c.periodId)?.label}.
              </li>
            ))}
          </Box>
        </Box>
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setParam({ view: v })}>
              {isTeacher && <ToggleButton value="mine" sx={{ px: 2, textTransform: 'none', fontWeight: 600 }}>My timetable</ToggleButton>}
              <ToggleButton value="class" sx={{ px: 2, textTransform: 'none', fontWeight: 600 }}>By class</ToggleButton>
              <ToggleButton value="teacher" sx={{ px: 2, textTransform: 'none', fontWeight: 600 }}>By teacher</ToggleButton>
            </ToggleButtonGroup>
            {view === 'class' && (
              <TextField select size="small" label="Class" value={activeClasses.some((c) => c.id === classId) ? classId : ''} onChange={(e) => setParam({ class: e.target.value })} sx={{ minWidth: 180 }}>
                {activeClasses.map((c) => {
                  const o = overview?.classes.find((x) => x.classId === c.id)
                  return <MenuItem key={c.id} value={c.id}>{labels.get(c.id) ?? c.name}{o ? <Box component="span" sx={{ ml: 1, color: brand.subtle, fontSize: '12.5px' }}>{o.filled}/{o.total}</Box> : null}</MenuItem>
                })}
              </TextField>
            )}
            {view === 'teacher' && (
              <TextField select size="small" label="Teacher" value={teacherId} onChange={(e) => setParam({ teacher: e.target.value })} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }} sx={{ minWidth: 220 }}>
                <MenuItem value="" disabled>Choose a teacher</MenuItem>
                {teachers.map((t) => <MenuItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</MenuItem>)}
              </TextField>
            )}
          </Stack>
          {view === 'class' && classWeek && (
            <Typography sx={{ fontSize: '13px', color: brand.muted, fontVariantNumeric: 'tabular-nums' }}>
              <Box component="span" sx={{ color: brand.text, fontWeight: 600 }}>{classWeek.filled}</Box> of {classWeek.total} lessons placed
            </Typography>
          )}
          {view !== 'class' && teacherWeek && (
            <Typography sx={{ fontSize: '13px', color: brand.muted }}><Box component="span" sx={{ color: brand.text, fontWeight: 600 }}>{teacherWeek.periodsPerWeek}</Box> periods a week</Typography>
          )}
        </Stack>

        {!week ? (
          view === 'teacher' && !teacherId ? (
            <Typography sx={{ color: brand.muted, fontSize: '14px', py: 3, textAlign: 'center' }}>
              {teachers.length ? 'Choose a teacher to see their week.' : 'Add teachers on the Teachers page to see their timetables.'}
            </Typography>
          ) : view === 'class' && classesLoaded && activeClasses.length === 0 ? (
            <Box sx={{ py: 4, textAlign: 'center' }}>
              <Typography sx={{ color: brand.muted, fontSize: '14px', mb: 1.5 }}>Create your classes first. Each class gets its own weekly timetable.</Typography>
              {isAdmin && <Button variant="outlined" onClick={() => navigate('/classes')}>Go to Classes</Button>}
            </Box>
          ) : error ? null : <Skeleton variant="rounded" height={360} />
        ) : (
          <>
            <WeekGrid setup={week.setup} lessons={week.lessons} show={view === 'class' ? 'teacher' : 'class'} onCell={view === 'class' && isAdmin ? (day, period, el) => setPicker({ el, day, period }) : undefined} />
            {view === 'class' && classWeek && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontSize: '13px', fontWeight: 700, mb: 0.75 }}>Periods a week</Typography>
                {classWeek.subjects.length === 0 ? (
                  <Typography sx={{ fontSize: '13.5px', color: brand.muted }}>This class has no subjects yet. Add them in Class subjects.</Typography>
                ) : (
                  <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap>
                    {classWeek.subjects.map((s) => (
                      <Box key={s.subjectId} sx={{ px: 1.1, py: 0.5, borderRadius: '9px', border: `1px solid ${brand.border}`, fontSize: '13px', opacity: s.periods ? 1 : 0.65 }}>
                        <b>{s.subject}</b> <Box component="span" sx={{ color: brand.muted, fontVariantNumeric: 'tabular-nums' }}>{s.periods}</Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            )}
          </>
        )}
      </Paper>

      <Menu anchorEl={picker?.el} open={!!picker} onClose={() => setPicker(null)}>
        {picker && <MenuItem disabled sx={{ fontSize: '12.5px', opacity: '1 !important', color: brand.muted }}>{DAY_LABEL[picker.day]} · {picker.period.label}</MenuItem>}
        {classWeek?.subjects.map((s) => (
          <MenuItem key={s.subjectId} selected={currentClassLesson?.subjectId === s.subjectId} onClick={() => place(s.subjectId)}>
            <Box>
              <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>{s.subject}</Typography>
              <Typography sx={{ fontSize: '12px', color: brand.subtle }}>{s.teacherName ?? 'No teacher assigned'} · {s.periods} a week</Typography>
            </Box>
          </MenuItem>
        ))}
        {classWeek?.subjects.length === 0 && <MenuItem disabled>No subjects. Add them in Class subjects.</MenuItem>}
        {currentClassLesson && <MenuItem onClick={() => place(null)} sx={{ color: '#9b2a22' }}>Clear this period</MenuItem>}
      </Menu>

      {setupOpen && overview && (
        <SetupDialog setup={overview.setup} onClose={() => setSetupOpen(false)} onSaved={() => { setSetupOpen(false); setNotice('School day saved'); loadOverview(); loadWeek() }} />
      )}

      {week && (
        <PrintArea active={printing} size="A4 landscape">
          <Typography sx={{ fontSize: '18px', fontWeight: 800, mb: 1.5, textAlign: 'center' }}>{title}</Typography>
          <WeekGrid setup={week.setup} lessons={week.lessons} show={view === 'class' ? 'teacher' : 'class'} compact />
        </PrintArea>
      )}

      <Snackbar open={!!notice} autoHideDuration={5000} onClose={() => setNotice('')} message={notice} />
    </Box>
  )
}

function SetupDialog({ setup, onClose, onSaved }: { setup: Setup; onClose: () => void; onSaved: () => void }) {
  const [days, setDays] = useState<Day[]>(setup.days)
  const [periods, setPeriods] = useState<Period[]>(setup.periods)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const update = (i: number, key: keyof Period, v: string) => setPeriods((ps) => ps.map((p, j) => (j === i ? { ...p, [key]: v } : p)))
  const add = (kind: 'LESSON' | 'BREAK') => setPeriods((ps) => {
    const last = ps[ps.length - 1]
    const lessons = ps.filter((p) => p.kind === 'LESSON').length
    const id = kind === 'LESSON' ? `p${Math.max(0, ...ps.filter((p) => /^p\d+$/.test(p.id)).map((p) => Number(p.id.slice(1)))) + 1}` : `b${Date.now().toString(36)}`
    const start = last?.end ?? '08:00'
    const [h, m] = start.split(':').map(Number)
    const endMins = h * 60 + m + (kind === 'LESSON' ? 40 : 20)
    const end = `${String(Math.floor(endMins / 60) % 24).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`
    return [...ps, { id, label: kind === 'LESSON' ? `Period ${lessons + 1}` : 'Break', start, end, kind }]
  })
  const save = async () => {
    setBusy(true)
    setError('')
    try { await saveSetup({ days, periods }); onSaved() } catch (err) { setError(errorText(err, 'Failed to save')); setBusy(false) }
  }
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>School day</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography sx={{ fontSize: '13px', fontWeight: 600, mb: 0.5 }}>Days</Typography>
        <Stack direction="row" flexWrap="wrap" sx={{ mb: 2 }}>
          {DAYS.map((d) => (
            <FormControlLabel key={d} control={<Checkbox size="small" checked={days.includes(d)} onChange={() => setDays((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))} />} label={DAY_LABEL[d]} />
          ))}
        </Stack>
        <Typography sx={{ fontSize: '13px', fontWeight: 600, mb: 1 }}>Periods and breaks</Typography>
        <Stack spacing={1}>
          {periods.map((p, i) => (
            <Stack key={p.id} direction="row" spacing={1} alignItems="center">
              <TextField size="small" value={p.label} onChange={(e) => update(i, 'label', e.target.value)} inputProps={{ maxLength: 30, 'aria-label': 'Name' }} sx={{ flex: 1, '& input': { fontWeight: p.kind === 'BREAK' ? 400 : 600, fontStyle: p.kind === 'BREAK' ? 'italic' : 'normal' } }} />
              <TextField size="small" type="time" value={p.start} onChange={(e) => update(i, 'start', e.target.value)} inputProps={{ 'aria-label': 'Starts' }} sx={{ width: 120 }} />
              <TextField size="small" type="time" value={p.end} onChange={(e) => update(i, 'end', e.target.value)} inputProps={{ 'aria-label': 'Ends' }} sx={{ width: 120 }} />
              <IconButton size="small" aria-label={`Remove ${p.label}`} onClick={() => setPeriods((ps) => ps.filter((_, j) => j !== i))} disabled={periods.length === 1}><RemoveIcon sx={{ fontSize: 18 }} /></IconButton>
            </Stack>
          ))}
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
          <Button size="small" startIcon={<AddIcon />} onClick={() => add('LESSON')}>Add period</Button>
          <Button size="small" startIcon={<AddIcon />} onClick={() => add('BREAK')}>Add break</Button>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={busy || days.length === 0}>{busy ? 'Saving…' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  )
}
