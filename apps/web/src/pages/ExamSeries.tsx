import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  ListItemIcon,
  Menu,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  EditOutlined as EditIcon,
  FileUpload as ImportIcon,
  MoreHoriz as MoreIcon,
  PlaylistAdd as AddPapersIcon,
  DeleteOutline as DeleteIcon,
  WarningAmberRounded as ClashIcon,
  CheckCircleRounded as OkIcon,
} from '@mui/icons-material'
import { api } from '../lib/api'
import { classLabels } from '../lib/classLabels'
import { schoolToday } from '../lib/attendanceApi'
import {
  ExamPaper,
  ExamSeriesDetail,
  TERM_LABEL,
  addPapers,
  countdown,
  daysBetween,
  deleteSeries,
  endTime,
  formatDuration,
  formatTime,
  getSeries,
  shortDate,
  updatePaper,
  updateSeries,
} from '../lib/examsApi'
import BulkImportDialog, { ColumnDef } from '../components/BulkImportDialog'
import { useAuthStore } from '../store/authStore'
import { brand } from '../theme'
import { DURATIONS, StatusBadge, dateRange, durationLabel } from './Exams'

const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL', 'VICE_PRINCIPAL']

interface ClassRow { id: string; name: string; status?: string; createdAt?: unknown }
interface TeacherRow { id: string; firstName: string; lastName: string; title?: string }

const importColumns: ColumnDef[] = [
  { key: 'className', label: 'Class', required: true },
  { key: 'subject', label: 'Subject', required: true },
  { key: 'date', label: 'Date', required: true },
  { key: 'startTime', label: 'Start Time', required: true },
  { key: 'duration', label: 'Duration' },
  { key: 'maxScore', label: 'Max Score' },
]

const amber = { bg: '#fdf0d5', fg: '#7a4c00', border: '#efc777' }
const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5))
const overlaps = (a: Pick<ExamPaper, 'startTime' | 'durationMinutes'>, b: Pick<ExamPaper, 'startTime' | 'durationMinutes'>) =>
  mins(a.startTime!) < mins(b.startTime!) + b.durationMinutes && mins(b.startTime!) < mins(a.startTime!) + a.durationMinutes
const byTime = (a: ExamPaper, b: ExamPaper) => (a.startTime ?? '').localeCompare(b.startTime ?? '')

export default function ExamSeriesPage() {
  const { seriesId = '' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const canEdit = ADMIN_ROLES.includes(useAuthStore((s) => s.user?.role) ?? '')
  const today = schoolToday()

  const [params, setParams] = useSearchParams()
  const view = params.get('view') === 'class' ? 'class' : 'day'
  const classFilter = params.get('class') ?? ''
  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const [series, setSeries] = useState<ExamSeriesDetail | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [error, setError] = useState('')
  const [loadFailed, setLoadFailed] = useState(false)
  const [notice, setNotice] = useState((location.state as { note?: string } | null)?.note ?? '')
  const [editing, setEditing] = useState<ExamPaper | null>(null)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      setSeries(await getSeries(seriesId))
    } catch (err: any) {
      setLoadFailed(true)
      setError(err.response?.status === 404 ? 'This exam was not found. It may have been deleted.' : err.response?.data?.message || 'Failed to load the exam')
    }
  }, [seriesId])

  useEffect(() => {
    load()
    api.get('/classes').then((r) => setClasses(r.data.data)).catch(() => {})
    api.get('/teachers').then((r) => setTeachers(r.data.data)).catch(() => {})
  }, [load])

  // Clear the "papers created" note from history so a refresh doesn't show it again.
  useEffect(() => {
    if (location.state) navigate(location.pathname + location.search, { replace: true, state: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const labels = useMemo(() => classLabels(classes), [classes])
  const className = (id: string) => labels.get(id) ?? classes.find((c) => c.id === id)?.name ?? 'Class'
  const teacherName = (id: string | null) => {
    const t = teachers.find((x) => x.id === id)
    return t ? `${t.title ? `${t.title} ` : ''}${t.firstName} ${t.lastName}`.trim() : ''
  }
  const byClassName = (a: string, b: string) => className(a).localeCompare(className(b), undefined, { numeric: true })

  const papers = series?.paperList ?? []
  const shown = papers.filter((p) => !classFilter || p.classId === classFilter)
  const inClash = useMemo(() => new Set(series?.clashes.flatMap((c) => c.paperIds) ?? []), [series])
  const paperById = useMemo(() => new Map(papers.map((p) => [p.id, p])), [papers])
  const examDays = new Set(papers.filter((p) => p.date).map((p) => p.date)).size

  const clashText = (c: ExamSeriesDetail['clashes'][number]) => {
    const [a, b] = c.paperIds.map((id) => paperById.get(id)!)
    if (!a || !b) return ''
    const when = `${shortDate(c.date)}, ${formatTime(a.startTime!)} and ${formatTime(b.startTime!)}`
    return c.reason === 'CLASS'
      ? `${className(a.classId)} has ${a.title} and ${b.title} at the same time (${when}).`
      : `${teacherName(a.teacherId) || 'The same teacher'} has ${className(a.classId)} ${a.title} and ${className(b.classId)} ${b.title} at the same time (${when}).`
  }

  const savePaper = async (paper: ExamPaper, body: Parameters<typeof updatePaper>[1]) => {
    await updatePaper(paper.id, body)
    await load()
  }

  const handleAddPapers = async () => {
    setMenuAnchor(null)
    setBusy(true)
    try {
      const res = await addPapers(seriesId)
      await load()
      setNotice(res.created ? `${res.created} new ${res.created === 1 ? 'paper' : 'papers'} added from Class subjects.` : 'Every class subject already has a paper.')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to add papers')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async () => {
    setMenuAnchor(null)
    if (!series || !window.confirm(`Delete "${series.name}" and its ${series.papers} papers? This can't be undone.`)) return
    try {
      await deleteSeries(seriesId)
      navigate('/exams', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete the exam')
    }
  }

  if (!series) {
    return (
      <Box sx={{ flexGrow: 1, maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate('/exams')} sx={{ mb: 2, ml: -1 }}>Exams</Button>
        {loadFailed ? <Alert severity="error">{error}</Alert> : <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={28} /></Box>}
      </Box>
    )
  }

  const pct = series.papers ? Math.round((series.scheduled / series.papers) * 100) : 0
  const totalDays = daysBetween(series.startDate, series.endDate) + 1
  const unscheduled = shown.filter((p) => !p.date || !p.startTime)
  const seriesClasses = [...new Set([...series.classIds, ...papers.map((p) => p.classId)])].sort(byClassName)

  const row = (p: ExamPaper, showDate: boolean) => {
    const clash = inClash.has(p.id)
    const scheduled = !!(p.date && p.startTime)
    return (
      <Box
        key={p.id}
        role="listitem"
        sx={{
          display: 'flex', alignItems: 'center', gap: { xs: 1.5, sm: 2 }, px: { xs: 1.5, sm: 2 }, py: 1.1,
          borderTop: `1px solid ${brand.border}`, '&:first-of-type': { borderTop: 'none' },
          boxShadow: clash ? `inset 3px 0 0 ${amber.border}` : 'none', bgcolor: clash ? '#fffaf0' : brand.surface,
        }}
      >
        <Box sx={{ width: { xs: 86, sm: showDate ? 176 : 132 }, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
          {scheduled ? (
            <>
              {showDate && <Typography sx={{ fontSize: '12.5px', color: brand.muted }}>{shortDate(p.date!)}</Typography>}
              <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: brand.text, whiteSpace: 'nowrap' }}>
                {formatTime(p.startTime!)}
                {!isPhone && <Box component="span" sx={{ color: brand.subtle, fontWeight: 500 }}> – {formatTime(endTime(p.startTime!, p.durationMinutes))}</Box>}
              </Typography>
            </>
          ) : (
            <Typography sx={{ fontSize: '13px', color: brand.subtle }}>{p.date ? `${shortDate(p.date)} · no time` : 'Not set'}</Typography>
          )}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} alignItems="center">
            <Typography noWrap sx={{ fontSize: '14.5px', fontWeight: 600 }}>{p.title}</Typography>
            {clash && (
              <Box component="span" sx={{ px: 0.75, borderRadius: 999, fontSize: '11.5px', fontWeight: 700, bgcolor: amber.bg, color: amber.fg, flexShrink: 0 }}>Clash</Box>
            )}
          </Stack>
          <Typography noWrap sx={{ fontSize: '12.5px', color: brand.muted }}>
            {view === 'day' || !classFilter ? `${className(p.classId)}` : ''}
            {view === 'day' || !classFilter ? (teacherName(p.teacherId) ? ' · ' : '') : ''}
            {teacherName(p.teacherId) || (view === 'class' && classFilter ? 'No teacher assigned' : '')}
          </Typography>
        </Box>
        <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: '12.5px', color: brand.muted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          {formatDuration(p.durationMinutes)} · <Box component="span" sx={{ color: brand.text }}>{p.maxScore}</Box> marks
        </Typography>
        {canEdit && (
          <Tooltip title="Set date and time">
            <IconButton size="small" aria-label={`Edit ${className(p.classId)} ${p.title}`} onClick={() => setEditing(p)} sx={{ color: brand.subtle }}>
              <EditIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        )}
      </Box>
    )
  }

  const group = (key: string, title: string, meta: string, items: ExamPaper[], showDate: boolean) => (
    <Box key={key} sx={{ mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 0.75, px: 0.25 }}>
        <Typography component="h3" sx={{ fontSize: '14px', fontWeight: 700 }}>{title}</Typography>
        <Typography sx={{ fontSize: '12.5px', color: brand.muted }}>{meta}</Typography>
      </Stack>
      <Box role="list" aria-label={title} sx={{ border: `1px solid ${brand.border}`, borderRadius: '12px', overflow: 'hidden' }}>
        {items.map((p) => row(p, showDate))}
      </Box>
    </Box>
  )

  const dayGroups = () => {
    const days = [...new Set(shown.filter((p) => p.date && p.startTime).map((p) => p.date!))].sort()
    return days.map((d) => {
      const items = shown.filter((p) => p.date === d && p.startTime).sort((a, b) => byTime(a, b) || byClassName(a.classId, b.classId))
      return group(d, new Date(`${d}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }),
        `Day ${daysBetween(series.startDate, d) + 1} · ${items.length} ${items.length === 1 ? 'paper' : 'papers'}`, items, false)
    })
  }

  const classGroups = () =>
    seriesClasses
      .filter((c) => !classFilter || c === classFilter)
      .map((c) => {
        const items = shown.filter((p) => p.classId === c && p.date && p.startTime)
          .sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '') || byTime(a, b))
        const total = papers.filter((p) => p.classId === c).length
        return items.length ? group(c, className(c), `${items.length} of ${total} scheduled`, items, true) : null
      })

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Button startIcon={<BackIcon />} onClick={() => navigate('/exams')} sx={{ mb: 1.5, ml: -1, color: brand.muted }}>Exams</Button>

      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2} sx={{ mb: 2.5 }}>
        <Box>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h4" sx={{ fontSize: { xs: '22px', sm: undefined } }}>{series.name}</Typography>
            <StatusBadge status={series.status} />
          </Stack>
          <Typography sx={{ color: brand.muted, fontSize: '14px', mt: 0.25 }}>
            {dateRange(series.startDate, series.endDate)} · {countdown(series, today)}
          </Typography>
        </Box>
        {canEdit && (
          <Stack direction="row" spacing={1}>
            <Button variant="contained" startIcon={<ImportIcon />} onClick={() => setImportOpen(true)}>Import timetable</Button>
            <IconButton aria-label="More actions" onClick={(e) => setMenuAnchor(e.currentTarget)} sx={{ border: `1px solid ${brand.border}`, borderRadius: '10px' }}>
              {busy ? <CircularProgress size={18} /> : <MoreIcon />}
            </IconButton>
            <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
              <MenuItem onClick={() => { setMenuAnchor(null); setDetailsOpen(true) }}><ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>Edit name and dates</MenuItem>
              <MenuItem onClick={handleAddPapers}><ListItemIcon><AddPapersIcon fontSize="small" /></ListItemIcon>Add missing papers</MenuItem>
              <MenuItem onClick={handleDelete} sx={{ color: '#9b2a22' }}><ListItemIcon><DeleteIcon fontSize="small" sx={{ color: '#9b2a22' }} /></ListItemIcon>Delete exam</MenuItem>
            </Menu>
          </Stack>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Summary */}
      <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', md: '2fr 1fr 1fr 1fr' }, gap: { xs: 2, md: 3 } }}>
          <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
            <Typography sx={{ fontSize: '12.5px', color: brand.muted, mb: 0.25 }}>Timetable</Typography>
            <Typography sx={{ fontSize: '15px', fontVariantNumeric: 'tabular-nums' }}>
              <Box component="span" sx={{ fontSize: '22px', fontWeight: 700 }}>{series.scheduled}</Box>
              <Box component="span" sx={{ color: brand.muted }}> of {series.papers} papers scheduled</Box>
            </Typography>
            <LinearProgress variant="determinate" value={pct} aria-label="Papers scheduled"
              sx={{ mt: 1, height: 5, borderRadius: 3, bgcolor: '#efeee8', '& .MuiLinearProgress-bar': { bgcolor: pct === 100 ? brand.accent : brand.green, borderRadius: 3 } }} />
          </Box>
          <Stat label="Clashes" value={series.clashes.length} tone={series.clashes.length ? 'warn' : 'ok'} />
          <Stat label="Exam days used" value={`${examDays} / ${totalDays}`} />
          <Stat label="Classes" value={seriesClasses.length} />
        </Box>
      </Paper>

      {/* Clash checker */}
      {series.clashes.length > 0 ? (
        <Box sx={{ border: `1px solid ${amber.border}`, bgcolor: '#fffaf0', borderRadius: '12px', p: { xs: 1.5, sm: 2 }, mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.75, color: amber.fg }}>
            <ClashIcon sx={{ fontSize: 19 }} />
            <Typography sx={{ fontSize: '14px', fontWeight: 700 }}>
              {series.clashes.length} {series.clashes.length === 1 ? 'clash needs' : 'clashes need'} fixing
            </Typography>
          </Stack>
          <Box component="ul" sx={{ m: 0, pl: 3.5, '& li': { fontSize: '13.5px', color: brand.text, py: 0.25 } }}>
            {series.clashes.map((c) => <li key={c.paperIds.join()}>{clashText(c)}</li>)}
          </Box>
        </Box>
      ) : series.scheduled > 1 ? (
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2, px: 0.5, color: '#1d5f36' }}>
          <OkIcon sx={{ fontSize: 18 }} />
          <Typography sx={{ fontSize: '13.5px' }}>No clashes: no class or teacher has two papers at once.</Typography>
        </Stack>
      ) : null}

      {/* Timetable */}
      <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" sx={{ mb: 2 }}>
          <ToggleButtonGroup size="small" exclusive value={view} onChange={(_, v) => v && setParam('view', v === 'day' ? '' : v)} aria-label="Timetable view">
            <ToggleButton value="day" sx={{ px: 2, textTransform: 'none', fontWeight: 600 }}>By day</ToggleButton>
            <ToggleButton value="class" sx={{ px: 2, textTransform: 'none', fontWeight: 600 }}>By class</ToggleButton>
          </ToggleButtonGroup>
          <TextField select size="small" label="Class" value={classFilter} onChange={(e) => setParam('class', e.target.value)}
            SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }} sx={{ width: { xs: '100%', sm: 220 } }}>
            <MenuItem value="">All classes</MenuItem>
            {seriesClasses.map((c) => <MenuItem key={c} value={c}>{className(c)}</MenuItem>)}
          </TextField>
        </Stack>

        {papers.length === 0 ? (
          <Typography sx={{ color: brand.muted, fontSize: '14px', py: 3, textAlign: 'center' }}>
            No papers yet. Give these classes their subjects in Class subjects, then choose “Add missing papers”.
          </Typography>
        ) : (
          <>
            {series.scheduled === 0 && (
              <Typography sx={{ color: brand.muted, fontSize: '13.5px', mb: 2 }}>
                {canEdit ? 'Nothing is scheduled yet. Set a date and time on each paper below, or import the whole timetable from a spreadsheet.' : 'The timetable has not been set yet.'}
              </Typography>
            )}
            {view === 'day' ? dayGroups() : classGroups()}
            {unscheduled.length > 0 &&
              group('unscheduled', 'Not scheduled yet', `${unscheduled.length} ${unscheduled.length === 1 ? 'paper' : 'papers'}`,
                [...unscheduled].sort((a, b) => byClassName(a.classId, b.classId) || a.title.localeCompare(b.title)), view === 'class')}
            {shown.length === 0 && (
              <Typography sx={{ color: brand.muted, fontSize: '14px', py: 3, textAlign: 'center' }}>
                {className(classFilter)} has no papers. Give it subjects in Class subjects, then choose “Add missing papers”.
              </Typography>
            )}
          </>
        )}
      </Paper>

      {editing && (
        <PaperDialog
          paper={editing}
          series={series}
          className={className}
          teacherName={teacherName}
          onClose={() => setEditing(null)}
          onSave={async (body) => {
            await savePaper(editing, body)
            setEditing(null)
            setNotice(`${className(editing.classId)} ${editing.title} saved`)
          }}
        />
      )}

      {detailsOpen && (
        <DetailsDialog
          series={series}
          onClose={() => setDetailsOpen(false)}
          onSaved={(s) => { setSeries(s); setDetailsOpen(false); setNotice('Exam details saved') }}
        />
      )}

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={load}
        title="Import exam timetable"
        endpoint={`/exam-series/${seriesId}/schedule-import`}
        columns={importColumns}
      />

      <Snackbar open={!!notice} autoHideDuration={notice.length > 60 ? 8000 : 3000} onClose={() => setNotice('')} message={notice} />
    </Box>
  )
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: 'ok' | 'warn' }) {
  return (
    <Box>
      <Typography sx={{ fontSize: '12.5px', color: brand.muted, mb: 0.25 }}>{label}</Typography>
      <Typography sx={{ fontSize: '22px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: tone === 'warn' ? amber.fg : brand.text }}>{value}</Typography>
    </Box>
  )
}

function PaperDialog({
  paper, series, className, teacherName, onClose, onSave,
}: {
  paper: ExamPaper
  series: ExamSeriesDetail
  className: (id: string) => string
  teacherName: (id: string | null) => string
  onClose: () => void
  onSave: (body: { date?: string | null; startTime?: string | null; durationMinutes?: number; maxScore?: number }) => Promise<void>
}) {
  const [date, setDate] = useState(paper.date ?? '')
  const [startTime, setStartTime] = useState(paper.startTime ?? '')
  const [duration, setDuration] = useState(paper.durationMinutes)
  const [maxScore, setMaxScore] = useState(String(paper.maxScore))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const score = Number(maxScore)
  const scoreOk = Number.isInteger(score) && score >= 1 && score <= 100
  const dateOk = !date || (date >= series.startDate && date <= series.endDate)
  const durations = DURATIONS.includes(duration) ? DURATIONS : [...DURATIONS, duration].sort((a, b) => a - b)

  // What else is on that day for this class or teacher, so clashes show before saving.
  const sameDay = date
    ? series.paperList.filter((p) => p.id !== paper.id && p.date === date && p.startTime && (p.classId === paper.classId || (paper.teacherId && p.teacherId === paper.teacherId)))
        .sort((a, b) => a.startTime!.localeCompare(b.startTime!))
    : []
  const draft = { startTime, durationMinutes: duration }
  const clashing = startTime ? sameDay.filter((p) => overlaps(draft, p)) : []

  const save = async (body: Parameters<typeof onSave>[0]) => {
    setSaving(true)
    setError('')
    try {
      await onSave(body)
    } catch (err: any) {
      const msg = err.response?.data?.message
      setError(Array.isArray(msg) ? msg[0] : msg || 'Failed to save')
      setSaving(false)
    }
  }

  const teacher = teacherName(paper.teacherId)

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 0.5 }}>
        <Typography component="span" sx={{ display: 'block', fontSize: '17px', fontWeight: 700 }}>{className(paper.classId)} · {paper.title}</Typography>
        <Typography component="span" sx={{ display: 'block', fontSize: '13px', color: brand.muted }}>{teacher || 'No teacher assigned in Class subjects'}</Typography>
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1.5 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <Stack direction="row" spacing={1.5}>
            <TextField type="date" label="Date" value={date} onChange={(e) => setDate(e.target.value)} InputLabelProps={{ shrink: true }}
              inputProps={{ min: series.startDate, max: series.endDate }} error={!dateOk}
              helperText={dateOk ? ' ' : `Between ${shortDate(series.startDate)} and ${shortDate(series.endDate)}`} fullWidth />
            <TextField type="time" label="Starts" value={startTime} onChange={(e) => setStartTime(e.target.value)} InputLabelProps={{ shrink: true }}
              inputProps={{ step: 300 }} helperText={startTime ? `Ends ${formatTime(endTime(startTime, duration))}` : ' '} sx={{ width: 150, flexShrink: 0 }} />
          </Stack>
          <Stack direction="row" spacing={1.5}>
            <TextField select label="Length" value={duration} onChange={(e) => setDuration(Number(e.target.value))} fullWidth>
              {durations.map((m) => <MenuItem key={m} value={m}>{durationLabel(m)}</MenuItem>)}
            </TextField>
            <TextField label="Max score" value={maxScore} onChange={(e) => setMaxScore(e.target.value.replace(/\D/g, ''))}
              inputProps={{ inputMode: 'numeric' }} error={!scoreOk} helperText={scoreOk ? ' ' : 'From 1 to 100'} sx={{ width: 150, flexShrink: 0 }} />
          </Stack>

          {date && dateOk && (
            <Box sx={{ border: `1px solid ${clashing.length ? amber.border : brand.border}`, bgcolor: clashing.length ? '#fffaf0' : '#fbfaf6', borderRadius: '10px', p: 1.5 }}>
              <Typography sx={{ fontSize: '12.5px', fontWeight: 700, color: clashing.length ? amber.fg : brand.muted, mb: 0.5 }}>
                {clashing.length ? 'This time clashes with' : sameDay.length ? `Also on ${shortDate(date)}` : `Nothing else for this class${paper.teacherId ? ' or teacher' : ''} on ${shortDate(date)}`}
              </Typography>
              {(clashing.length ? clashing : sameDay).map((p) => (
                <Typography key={p.id} sx={{ fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
                  {formatTime(p.startTime!)}–{formatTime(endTime(p.startTime!, p.durationMinutes))} · {className(p.classId)} {p.title}
                  {p.classId !== paper.classId && <Box component="span" sx={{ color: brand.muted }}> (same teacher)</Box>}
                </Typography>
              ))}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5, justifyContent: 'space-between' }}>
        <Box>
          {paper.date && (
            <ButtonBase disabled={saving} onClick={() => save({ date: null })} sx={{ fontSize: '13.5px', fontWeight: 600, color: brand.muted, px: 1, py: 0.75, borderRadius: '8px' }}>
              Clear date
            </ButtonBase>
          )}
        </Box>
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            disabled={saving || !dateOk || !scoreOk || (!!startTime && !date)}
            onClick={() => save({
              ...(date ? { date, startTime: startTime || null } : paper.date ? { date: null } : {}),
              durationMinutes: duration,
              maxScore: score,
            })}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}

function DetailsDialog({ series, onClose, onSaved }: { series: ExamSeriesDetail; onClose: () => void; onSaved: (s: ExamSeriesDetail) => void }) {
  const [name, setName] = useState(series.name)
  const [startDate, setStartDate] = useState(series.startDate)
  const [endDate, setEndDate] = useState(series.endDate)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      onSaved(await updateSeries(series.id, { name: name.trim(), startDate, endDate }))
    } catch (err: any) {
      const msg = err.response?.data?.message
      setError(Array.isArray(msg) ? msg[0] : msg || 'Failed to save')
      setSaving(false)
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Edit exam</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} inputProps={{ maxLength: 100 }} />
          <Stack direction="row" spacing={1.5}>
            <TextField type="date" label="First paper" value={startDate} onChange={(e) => setStartDate(e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
            <TextField type="date" label="Last paper" value={endDate} onChange={(e) => setEndDate(e.target.value)} InputLabelProps={{ shrink: true }}
              inputProps={{ min: startDate }} fullWidth />
          </Stack>
          <Typography sx={{ fontSize: '12.5px', color: brand.subtle }}>
            {TERM_NOTE(series)}
          </Typography>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !name.trim() || !startDate || !endDate || endDate < startDate}>
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const TERM_NOTE = (s: ExamSeriesDetail) => `${TERM_LABEL[s.term]}, ${s.session}. Papers already scheduled must stay within the dates.`
