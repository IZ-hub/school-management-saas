import { KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  CheckCircleRounded as DoneIcon,
  RadioButtonUncheckedRounded as WaitingIcon,
  DoneAllRounded as AllPresentIcon,
} from '@mui/icons-material'
import { api } from '../lib/api'
import { classLabels } from '../lib/classLabels'
import {
  AttendanceStatus,
  Register,
  STATUSES,
  TodayOverview,
  getRegister,
  getToday,
  saveRegister,
  schoolToday,
  toDate,
} from '../lib/attendanceApi'
import { brand } from '../theme'
import { MyScope, UNLINKED_MESSAGE, getMyScope } from '../lib/scopeApi'

// Status colours are paired with a word (and a letter on phones), never colour alone.
const STATUS_STYLE: Record<AttendanceStatus, { label: string; key: string; bg: string; fg: string; border: string }> = {
  PRESENT: { label: 'Present', key: 'P', bg: '#e3f1e6', fg: '#1d5f36', border: '#9fcdab' },
  ABSENT: { label: 'Absent', key: 'A', bg: '#fbe4e2', fg: '#9b2a22', border: '#eba7a0' },
  LATE: { label: 'Late', key: 'L', bg: '#fdf0d5', fg: '#7a4c00', border: '#efc777' },
  EXCUSED: { label: 'Excused', key: 'E', bg: '#e6ebf2', fg: '#36485e', border: '#b3c0d1' },
}

const timeOf = (value: unknown) => toDate(value)?.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })
const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

interface ClassRow { id: string; name: string; status?: string; createdAt?: unknown }

export default function Attendance() {
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const today = schoolToday()

  const [params, setParams] = useSearchParams()
  const classId = params.get('class') ?? ''
  const date = params.get('date') ?? today

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [scope, setScope] = useState<MyScope | null>(null)
  const [overview, setOverview] = useState<TodayOverview | null>(null)
  const [register, setRegister] = useState<Register | null>(null)
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>({})
  const [loadingRegister, setLoadingRegister] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [focusIndex, setFocusIndex] = useState(0)
  const rowRefs = useRef<(HTMLDivElement | null)[]>([])

  const labels = useMemo(() => classLabels(classes), [classes])
  const activeClasses = useMemo(
    () =>
      classes
        .filter((c) => c.status !== 'INACTIVE' && (!scope || scope.all || scope.classIds.includes(c.id)))
        .sort((a, b) => (labels.get(a.id) ?? a.name).localeCompare(labels.get(b.id) ?? b.name, undefined, { numeric: true })),
    [classes, labels, scope],
  )

  const loadOverview = useCallback(() => {
    getToday()
      .then(setOverview)
      .catch(() => setOverview(null))
  }, [])

  useEffect(() => {
    api.get('/classes').then((res) => setClasses(res.data.data)).catch(() => setError('Failed to load classes'))
    getMyScope().then(setScope).catch(() => {})
    loadOverview()
  }, [loadOverview])

  // Load the register whenever the class or date changes.
  useEffect(() => {
    if (!classId) {
      setRegister(null)
      return
    }
    setLoadingRegister(true)
    setError('')
    getRegister(classId, date)
      .then((r) => {
        setRegister(r)
        // Unmarked students start as Present: the teacher only taps the exceptions.
        setMarks(Object.fromEntries(r.students.map((s) => [s.id, s.status ?? 'PRESENT'])))
        setFocusIndex(0)
      })
      .catch((err) => {
        setRegister(null)
        setError(err.response?.data?.message || 'Failed to load the register')
      })
      .finally(() => setLoadingRegister(false))
  }, [classId, date])

  const changedCount = register ? register.students.filter((s) => s.status !== marks[s.id]).length : 0
  const isTaken = !!register?.takenAt
  const dirty = !!register && (changedCount > 0 || (!isTaken && register.students.length > 0))

  // Warn before leaving the page with an unsaved register.
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const choose = (key: 'class' | 'date', value: string) => {
    if (dirty && changedCount > 0 && !window.confirm('You have unsaved changes in this register. Leave without saving?')) return
    const next = new URLSearchParams(params)
    if (value && !(key === 'date' && value === today)) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const counts = useMemo(() => {
    const c: Record<AttendanceStatus, number> = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 }
    Object.values(marks).forEach((s) => c[s]++)
    return c
  }, [marks])

  const setMark = (studentId: string, status: AttendanceStatus) => setMarks((m) => ({ ...m, [studentId]: status }))

  const markAllPresent = () => register && setMarks(Object.fromEntries(register.students.map((s) => [s.id, 'PRESENT'])))

  const handleSave = async () => {
    if (!register) return
    setSaving(true)
    setError('')
    try {
      const saved = await saveRegister(
        register.classId,
        register.date,
        register.students.map((s) => ({ studentId: s.id, status: marks[s.id] })),
      )
      setRegister(saved)
      setNotice(`Register saved for ${labels.get(saved.classId) ?? saved.className}`)
      loadOverview()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to save the register')
    } finally {
      setSaving(false)
    }
  }

  // Keyboard: ↑/↓ move between students, P/A/L/E mark and move to the next one.
  const onListKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!register || register.students.length === 0) return
    const last = register.students.length - 1
    const move = (i: number) => {
      const next = Math.max(0, Math.min(last, i))
      setFocusIndex(next)
      rowRefs.current[next]?.focus()
    }
    const key = e.key.toUpperCase()
    const status = STATUSES.find((s) => STATUS_STYLE[s].key === key)
    if (e.key === 'ArrowDown') { e.preventDefault(); move(focusIndex + 1) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(focusIndex - 1) }
    else if (status && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      setMark(register.students[focusIndex].id, status)
      move(focusIndex + 1)
    }
  }

  const takenNote = () => {
    if (!register) return null
    if (isTaken) {
      const when = timeOf(register.takenAt)
      const day = register.date === today ? '' : ` on ${new Date(`${register.date}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
      return `Taken${day} at ${when}${register.takenByName ? ` by ${register.takenByName}` : ''}`
    }
    return 'Not taken yet. Everyone starts as Present, so just mark who is absent, late or excused.'
  }

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 }, pb: { xs: 12, md: 4.5 } }}>
      <Typography variant="h4">Attendance</Typography>
      <Typography sx={{ color: brand.muted, fontSize: '14.5px', mb: 3 }}>Take the daily register for each class.</Typography>

      {scope && !scope.linked && <Alert severity="info" sx={{ mb: 2 }}>{UNLINKED_MESSAGE}</Alert>}

      {/* Today at a glance */}
      <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'baseline' }} spacing={0.5} sx={{ mb: 1.5 }}>
          <Typography component="h2" sx={{ fontSize: '15px', fontWeight: 700 }}>Today · {longDate(today)}</Typography>
          {overview && (
            <Typography sx={{ fontSize: '13.5px', color: brand.muted }}>
              {overview.classesTaken} of {overview.classesTotal} {overview.classesTotal === 1 ? 'class' : 'classes'} marked
              {overview.rate !== null && <> · <Box component="span" sx={{ color: brand.text, fontWeight: 600 }}>{overview.rate}%</Box> present</>}
            </Typography>
          )}
        </Stack>
        {!overview ? (
          <Skeleton height={36} />
        ) : overview.classes.length === 0 ? (
          <Typography sx={{ fontSize: '14px', color: brand.muted }}>Create your classes first, on the Classes page.</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {overview.classes.map((c) => (
              <ButtonBase
                key={c.id}
                onClick={() => {
                  if (date !== today) {
                    const next = new URLSearchParams(params)
                    next.delete('date')
                    next.set('class', c.id)
                    setParams(next, { replace: true })
                  } else choose('class', c.id)
                }}
                aria-label={`${labels.get(c.id) ?? c.name}: ${c.taken ? `register taken, ${c.rate ?? 0}% present` : 'register not taken yet'}`}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.75, borderRadius: '10px',
                  border: `1px solid ${c.id === classId ? brand.green : brand.border}`, bgcolor: c.id === classId ? brand.greenSoft : brand.surface,
                  '&:hover': { borderColor: brand.green },
                }}
              >
                {c.taken ? <DoneIcon sx={{ fontSize: 17, color: '#1f6f43' }} /> : <WaitingIcon sx={{ fontSize: 17, color: '#b8b5aa' }} />}
                <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: brand.text }}>{labels.get(c.id) ?? c.name}</Typography>
                <Typography sx={{ fontSize: '12.5px', color: brand.muted }}>{c.taken ? `${c.rate ?? 0}%` : 'Not taken'}</Typography>
              </ButtonBase>
            ))}
          </Box>
        )}
      </Paper>

      {/* Register */}
      <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
          <TextField select label="Class" value={classId} onChange={(e) => choose('class', e.target.value)}
            SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }} sx={{ width: { xs: '100%', sm: 240 } }}>
            <MenuItem value="" disabled>Choose a class</MenuItem>
            {activeClasses.map((c) => <MenuItem key={c.id} value={c.id}>{labels.get(c.id) ?? c.name}</MenuItem>)}
          </TextField>
          <TextField type="date" label="Date" value={date} onChange={(e) => e.target.value && choose('date', e.target.value)}
            inputProps={{ max: today }} InputLabelProps={{ shrink: true }} sx={{ width: { xs: '100%', sm: 200 } }} />
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

        {!classId ? (
          <Typography sx={{ color: brand.muted, fontSize: '14px', py: 3, textAlign: 'center' }}>
            Choose a class above, or tap one in Today, to take its register.
          </Typography>
        ) : loadingRegister || !register ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>{loadingRegister ? <CircularProgress size={28} /> : null}</Box>
        ) : register.students.length === 0 ? (
          <Typography sx={{ color: brand.muted, fontSize: '14px', py: 3, textAlign: 'center' }}>
            {labels.get(register.classId) ?? register.className} has no students yet. Add students to this class first.
          </Typography>
        ) : (
          <>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} spacing={1.5} sx={{ mb: 1.5 }}>
              <Box>
                <Typography sx={{ fontSize: '15px', fontWeight: 700 }}>
                  {labels.get(register.classId) ?? register.className} · {register.students.length} students
                </Typography>
                <Typography sx={{ fontSize: '13px', color: isTaken ? brand.muted : '#7a4c00' }}>{takenNote()}</Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                {STATUSES.map((s) => (
                  <Box key={s} sx={{ px: 1, py: 0.25, borderRadius: 999, fontSize: '12.5px', fontWeight: 600, bgcolor: STATUS_STYLE[s].bg, color: STATUS_STYLE[s].fg }}>
                    {STATUS_STYLE[s].label} {counts[s]}
                  </Box>
                ))}
                <Button size="small" startIcon={<AllPresentIcon />} onClick={markAllPresent} sx={{ ml: { md: 1 } }}>Mark all present</Button>
              </Stack>
            </Stack>

            {!isPhone && (
              <Typography sx={{ fontSize: '12.5px', color: brand.subtle, mb: 1 }}>
                Tip: click a name, then use ↑ ↓ to move and P, A, L or E to mark.
              </Typography>
            )}

            <Box role="list" aria-label={`Register for ${register.className}`} onKeyDown={onListKeyDown} sx={{ border: `1px solid ${brand.border}`, borderRadius: '12px', overflow: 'hidden' }}>
              {register.students.map((s, i) => {
                const status = marks[s.id]
                const changed = s.status !== status
                return (
                  <Box
                    key={s.id}
                    role="listitem"
                    ref={(el: HTMLDivElement | null) => (rowRefs.current[i] = el)}
                    tabIndex={i === focusIndex ? 0 : -1}
                    onFocus={() => setFocusIndex(i)}
                    aria-label={`${s.firstName} ${s.lastName}, ${STATUS_STYLE[status].label}`}
                    sx={{
                      display: 'flex', alignItems: 'center', gap: 1.5, px: { xs: 1.5, sm: 2 }, py: 1.1,
                      borderTop: i === 0 ? 'none' : `1px solid ${brand.border}`,
                      bgcolor: status === 'PRESENT' ? brand.surface : STATUS_STYLE[status].bg + '66',
                      outline: 'none', '&:focus-visible': { boxShadow: `inset 3px 0 0 ${brand.green}`, bgcolor: '#f4f8f3' },
                    }}
                  >
                    <Typography sx={{ width: 22, flexShrink: 0, fontSize: '12.5px', color: brand.subtle, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{i + 1}</Typography>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: '14.5px', fontWeight: 600 }}>
                        {s.firstName} {s.lastName}
                        {changed && isTaken && <Box component="span" sx={{ ml: 0.75, fontSize: '11.5px', fontWeight: 600, color: '#7a4c00' }}>• edited</Box>}
                      </Typography>
                      <Typography noWrap sx={{ fontSize: '12px', color: brand.subtle }}>{s.admissionNumber}</Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5} role="radiogroup" aria-label={`Mark ${s.firstName} ${s.lastName}`}>
                      {STATUSES.map((opt) => {
                        const on = status === opt
                        const st = STATUS_STYLE[opt]
                        return (
                          <ButtonBase
                            key={opt}
                            role="radio"
                            aria-checked={on}
                            aria-label={st.label}
                            tabIndex={-1}
                            onClick={() => { setMark(s.id, opt); setFocusIndex(i) }}
                            sx={{
                              minWidth: { xs: 36, sm: 74 }, height: 34, px: { xs: 0, sm: 1.25 }, borderRadius: '8px',
                              fontSize: '13px', fontWeight: 600,
                              border: `1px solid ${on ? st.border : brand.border}`,
                              bgcolor: on ? st.bg : brand.surface, color: on ? st.fg : brand.subtle,
                              '&:hover': { borderColor: st.border, color: st.fg },
                            }}
                          >
                            {isPhone ? st.key : st.label}
                          </ButtonBase>
                        )
                      })}
                    </Stack>
                  </Box>
                )
              })}
            </Box>

            {/* Save bar: sticks to the bottom of the screen on phones */}
            <Box
              sx={{
                position: { xs: 'fixed', md: 'static' }, left: 0, right: 0, bottom: 0, zIndex: 10,
                bgcolor: { xs: 'rgba(255,255,255,0.97)', md: 'transparent' }, borderTop: { xs: `1px solid ${brand.border}`, md: 'none' },
                px: { xs: 2, md: 0 }, py: { xs: 1.25, md: 0 }, mt: { md: 2 },
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
              }}
            >
              <Typography sx={{ fontSize: '13px', color: brand.muted }}>
                {isTaken ? (changedCount > 0 ? `${changedCount} unsaved ${changedCount === 1 ? 'change' : 'changes'}` : 'All changes saved') : 'Not saved yet'}
              </Typography>
              <Button variant="contained" onClick={handleSave} disabled={saving || (isTaken && changedCount === 0)} sx={{ px: 3, minHeight: 42 }}>
                {saving ? 'Saving…' : isTaken ? 'Save changes' : 'Save register'}
              </Button>
            </Box>
          </>
        )}
      </Paper>

      <Snackbar open={!!notice} autoHideDuration={3000} onClose={() => setNotice('')} message={notice} />
    </Box>
  )
}
