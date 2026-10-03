import { ClipboardEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  InputBase,
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
import { CheckCircleRounded as DoneIcon, RadioButtonUncheckedRounded as EmptyIcon, TimelapseRounded as PartIcon } from '@mui/icons-material'
import { api } from '../lib/api'
import { classLabels } from '../lib/classLabels'
import { toDate } from '../lib/attendanceApi'
import { ExamSeries, listSeries } from '../lib/examsApi'
import { GRADES, GRADE_STYLE, PaperProgress, ScoreSheet, getProgress, getSheet, gradeFor, saveSheet } from '../lib/resultsApi'
import { brand } from '../theme'
import { MyScope, UNLINKED_MESSAGE, getMyScope } from '../lib/scopeApi'

interface ClassRow { id: string; name: string; status?: string; createdAt?: unknown }
type Part = 'ca' | 'exam'
type Draft = Record<string, { ca: string; exam: string }>

const fmt = (n: number | null) => (n === null ? '' : String(n))
const round1 = (n: number) => Math.round(n * 10) / 10

/** '' -> null, '35' -> 35, '12.5' -> 12.5; undefined when it isn't a valid score. */
const parseScore = (raw: string): number | null | undefined => {
  const v = raw.trim()
  if (v === '') return null
  if (!/^\d{1,3}(\.\d)?$/.test(v)) return undefined
  return Number(v)
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return <Typography sx={{ fontSize: '13px', color: brand.subtle }}>—</Typography>
  const s = GRADE_STYLE[grade]
  return (
    <Box component="span" sx={{ display: 'inline-flex', justifyContent: 'center', minWidth: 26, px: 0.75, py: 0.25, borderRadius: '6px', fontSize: '13px', fontWeight: 700, bgcolor: s.bg, color: s.fg }}>
      {grade}
    </Box>
  )
}

export default function Results() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const [params, setParams] = useSearchParams()
  const seriesId = params.get('exam') ?? ''
  const paperId = params.get('paper') ?? ''

  const [series, setSeries] = useState<ExamSeries[] | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [progress, setProgress] = useState<PaperProgress[] | null>(null)
  const [sheet, setSheet] = useState<ScoreSheet | null>(null)
  const [draft, setDraft] = useState<Draft>({})
  const [loadingSheet, setLoadingSheet] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const cells = useRef<Map<string, HTMLInputElement>>(new Map())
  const [scope, setScope] = useState<MyScope | null>(null)
  useEffect(() => { getMyScope().then(setScope).catch(() => {}) }, [])
  const justFocused = useRef(false)

  const labels = useMemo(() => classLabels(classes), [classes])
  const className = (id: string) => labels.get(id) ?? classes.find((c) => c.id === id)?.name ?? 'Class'

  useEffect(() => {
    api.get('/classes').then((r) => setClasses(r.data.data)).catch(() => {})
    listSeries()
      .then((list) => setSeries([...list].sort((a, b) => b.startDate.localeCompare(a.startDate))))
      .catch(() => { setSeries([]); setError('Failed to load exams') })
  }, [])

  // Default to the exam in progress, else the most recent one.
  useEffect(() => {
    if (!series || seriesId || series.length === 0) return
    const pick = series.find((s) => s.status === 'IN_PROGRESS') ?? series[0]
    const next = new URLSearchParams(params)
    next.set('exam', pick.id)
    setParams(next, { replace: true })
  }, [series, seriesId, params, setParams])

  const loadProgress = useCallback(() => {
    if (!seriesId) return
    getProgress(seriesId).then(setProgress).catch((err) => { setProgress([]); setError(err.response?.data?.message || 'Failed to load progress') })
  }, [seriesId])

  useEffect(() => {
    setProgress(null)
    loadProgress()
  }, [loadProgress])

  const resetDraft = (s: ScoreSheet) => setDraft(Object.fromEntries(s.students.map((st) => [st.id, { ca: fmt(st.ca), exam: fmt(st.exam) }])))

  useEffect(() => {
    if (!paperId) { setSheet(null); return }
    setLoadingSheet(true)
    setError('')
    getSheet(paperId)
      .then((s) => { setSheet(s); resetDraft(s) })
      .catch((err) => { setSheet(null); setError(err.response?.data?.message || 'Failed to load the score sheet') })
      .finally(() => setLoadingSheet(false))
  }, [paperId])

  // Rows the teacher has changed since the last save.
  const changed = useMemo(
    () => (sheet ? sheet.students.filter((s) => draft[s.id] && (draft[s.id].ca !== fmt(s.ca) || draft[s.id].exam !== fmt(s.exam))) : []),
    [sheet, draft],
  )
  const dirty = changed.length > 0

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const choose = (key: 'exam' | 'paper', value: string) => {
    if (dirty && !window.confirm('You have unsaved scores. Leave without saving?')) return
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key === 'exam') next.delete('paper')
    setParams(next, { replace: key === 'exam' })
  }

  const problem = (raw: string, max: number) => {
    const v = parseScore(raw)
    if (v === undefined) return 'Use a number like 35 or 12.5'
    if (v !== null && v > max) return `Out of ${max}`
    return ''
  }

  const rows = useMemo(() => {
    if (!sheet) return []
    return sheet.students.map((s) => {
      const d = draft[s.id] ?? { ca: '', exam: '' }
      const ca = parseScore(d.ca)
      const exam = parseScore(d.exam)
      const caOk = sheet.caMax === 0 || (ca !== undefined && ca !== null && ca <= sheet.caMax)
      const examOk = exam !== undefined && exam !== null && exam <= sheet.examMax
      const total = caOk && examOk ? round1((sheet.caMax ? (ca as number) : 0) + (exam as number)) : null
      return { s, d, total, grade: total === null ? null : gradeFor(total) }
    })
  }, [sheet, draft])

  const errors = sheet ? rows.filter((r) => problem(r.d.ca, sheet.caMax) || problem(r.d.exam, sheet.examMax)).length : 0
  const totals = rows.map((r) => r.total).filter((t): t is number => t !== null)
  const stats = totals.length
    ? { avg: round1(totals.reduce((a, b) => a + b, 0) / totals.length), hi: Math.max(...totals), lo: Math.min(...totals) }
    : null
  const gradeCounts = GRADES.map((g) => [g, rows.filter((r) => r.grade === g).length] as const)

  const setCell = (id: string, part: Part, value: string) => setDraft((d) => ({ ...d, [id]: { ...d[id], [part]: value } }))
  const parts: Part[] = sheet?.caMax ? ['ca', 'exam'] : ['exam']
  const focusCell = (row: number, part: Part) => {
    const s = sheet?.students[row]
    const el = s && cells.current.get(`${s.id}:${part}`)
    if (el) { el.focus(); el.select() }
  }

  // Enter and ↓ go down the column, ↑ goes up; ← → move across at the edge of the text.
  const onCellKey = (e: KeyboardEvent<HTMLInputElement>, row: number, part: Part) => {
    const el = e.currentTarget
    const col = parts.indexOf(part)
    if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); focusCell(row + 1, part) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); focusCell(row - 1, part) }
    else if (e.key === 'ArrowRight' && el.selectionStart === el.value.length && col < parts.length - 1) { e.preventDefault(); focusCell(row, parts[col + 1]) }
    else if (e.key === 'ArrowLeft' && el.selectionStart === 0 && col > 0) { e.preventDefault(); focusCell(row, parts[col - 1]) }
  }

  // Pasting a column (or CA + exam columns) from a spreadsheet fills down from this cell.
  const onCellPaste = (e: ClipboardEvent<HTMLInputElement>, row: number, part: Part) => {
    if (!sheet) return
    const text = e.clipboardData.getData('text')
    const lines = text.replace(/\r/g, '').split('\n').filter((l, i, a) => l !== '' || i < a.length - 1)
    if (lines.length <= 1 && !text.includes('\t')) return
    e.preventDefault()
    const start = parts.indexOf(part)
    setDraft((d) => {
      const next = { ...d }
      lines.forEach((line, i) => {
        const s = sheet.students[row + i]
        if (!s) return
        line.split('\t').forEach((v, j) => {
          const p = parts[start + j]
          if (p) next[s.id] = { ...next[s.id], [p]: v.trim() }
        })
      })
      return next
    })
    const filled = Math.min(lines.length, sheet.students.length - row)
    setNotice(`Pasted scores for ${filled} ${filled === 1 ? 'student' : 'students'}. Check them, then save.`)
  }

  const handleSave = async () => {
    if (!sheet) return
    setSaving(true)
    setError('')
    try {
      const saved = await saveSheet(
        sheet.examId,
        changed.map((s) => ({ studentId: s.id, ca: sheet.caMax ? (parseScore(draft[s.id].ca) as number | null) : null, exam: parseScore(draft[s.id].exam) as number | null })),
      )
      setSheet(saved)
      resetDraft(saved)
      setNotice(`Saved ${className(saved.classId)} ${saved.subject}`)
      loadProgress()
    } catch (err: any) {
      const msg = err.response?.data?.message
      setError(Array.isArray(msg) ? msg[0] : msg || 'Failed to save scores')
    } finally {
      setSaving(false)
    }
  }

  // Progress grouped by class.
  const byClass = useMemo(() => {
    const map = new Map<string, PaperProgress[]>()
    for (const p of progress ?? []) map.set(p.classId, [...(map.get(p.classId) ?? []), p])
    return [...map.entries()].sort(([a], [b]) => className(a).localeCompare(className(b), undefined, { numeric: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, labels])
  const papersDone = (progress ?? []).filter((p) => p.students > 0 && p.complete >= p.students).length
  const current = series?.find((s) => s.id === seriesId)

  const updatedNote = () => {
    if (!sheet?.updatedAt) return 'No scores saved yet.'
    const when = toDate(sheet.updatedAt)
    return `Last saved ${when ? when.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }) : ''}${sheet.updatedByName ? ` by ${sheet.updatedByName}` : ''}`
  }

  const cell = (id: string, row: number, part: Part, value: string, max: number) => {
    const bad = problem(value, max)
    return (
      <InputBase
        value={value}
        onChange={(e) => setCell(id, part, e.target.value.replace(/[^\d.]/g, '').slice(0, 5))}
        onKeyDown={(e) => onCellKey(e as KeyboardEvent<HTMLInputElement>, row, part)}
        onPaste={(e) => onCellPaste(e as ClipboardEvent<HTMLInputElement>, row, part)}
        // Select on focus so typing replaces the old score; stop the click's mouseup from undoing it.
        onFocus={(e) => { e.target.select(); justFocused.current = true }}
        onMouseUp={(e) => { if (justFocused.current) e.preventDefault(); justFocused.current = false }}
        onBlur={() => { justFocused.current = false }}
        inputRef={(el: HTMLInputElement | null) => { if (el) cells.current.set(`${id}:${part}`, el); else cells.current.delete(`${id}:${part}`) }}
        inputProps={{ inputMode: 'decimal', 'aria-label': `${part === 'ca' ? 'CA' : 'Exam'} for ${sheet!.students[row].firstName} ${sheet!.students[row].lastName}`, 'aria-invalid': !!bad, title: bad || undefined }}
        readOnly={!sheet!.canEdit}
        sx={{
          width: { xs: 56, sm: 72 }, height: 36, px: 1, borderRadius: '8px', fontSize: '14.5px', fontWeight: 600, fontVariantNumeric: 'tabular-nums',
          border: `1px solid ${bad ? '#e0928a' : brand.border}`, bgcolor: bad ? '#fdf3f2' : brand.surface,
          '&.Mui-focused': { borderColor: bad ? '#c4483d' : brand.green, boxShadow: `0 0 0 3px ${bad ? '#f6d6d2' : '#dfe9dc'}` },
          '& input': { textAlign: 'center', p: 0 },
        }}
      />
    )
  }

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 }, pb: { xs: 12, md: 4.5 } }}>
      <Typography variant="h4">Results</Typography>
      <Typography sx={{ color: brand.muted, fontSize: '14.5px', mb: 3 }}>Enter CA and exam scores for each class and subject.</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {scope && !scope.linked && <Alert severity="info" sx={{ mb: 2 }}>{UNLINKED_MESSAGE}</Alert>}

      {!series ? (
        <Skeleton variant="rounded" height={140} />
      ) : series.length === 0 ? (
        <Paper sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
          <Typography sx={{ fontSize: '16px', fontWeight: 700, mb: 0.75 }}>No exams yet</Typography>
          <Typography sx={{ fontSize: '14px', color: brand.muted, mb: 2.5 }}>Scores are entered against an exam's papers. Create the exam first.</Typography>
          <Button variant="contained" onClick={() => navigate('/exams')}>Go to Exams</Button>
        </Paper>
      ) : (
        <>
          {/* Scoring progress */}
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
              <TextField select size="small" label="Exam" value={seriesId} onChange={(e) => choose('exam', e.target.value)} sx={{ width: { xs: '100%', sm: 360 } }}>
                {series.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
              </TextField>
              {progress && progress.length > 0 && (
                <Typography sx={{ fontSize: '13.5px', color: brand.muted, fontVariantNumeric: 'tabular-nums' }}>
                  <Box component="span" sx={{ color: brand.text, fontWeight: 600 }}>{papersDone}</Box> of {progress.length} papers fully scored
                </Typography>
              )}
            </Stack>

            {!progress ? (
              <Skeleton height={60} />
            ) : progress.length === 0 ? (
              <Typography sx={{ fontSize: '14px', color: brand.muted }}>
                {current ? `${current.name} has no papers yet.` : ''} Add papers on the Exams page.
              </Typography>
            ) : (
              <Stack spacing={1.25}>
                {byClass.map(([classId, list]) => (
                  <Stack key={classId} direction={{ xs: 'column', md: 'row' }} spacing={{ xs: 0.75, md: 1.5 }} alignItems={{ md: 'flex-start' }}>
                    <Typography sx={{ width: { md: 110 }, flexShrink: 0, fontSize: '13.5px', fontWeight: 700, pt: { md: 0.9 } }}>{className(classId)}</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                      {list.map((p) => {
                        const done = p.students > 0 && p.complete >= p.students
                        const on = p.examId === paperId
                        return (
                          <ButtonBase
                            key={p.examId}
                            onClick={() => choose('paper', p.examId)}
                            aria-label={`${className(classId)} ${p.subject}: ${p.complete} of ${p.students} scored`}
                            sx={{
                              display: 'flex', alignItems: 'center', gap: 0.75, px: 1.1, py: 0.6, borderRadius: '9px',
                              border: `1px solid ${on ? brand.green : brand.border}`, bgcolor: on ? brand.greenSoft : brand.surface,
                              '&:hover': { borderColor: brand.green },
                            }}
                          >
                            {done ? <DoneIcon sx={{ fontSize: 16, color: '#1f6f43' }} /> : p.started > 0 ? <PartIcon sx={{ fontSize: 16, color: '#b07a1a' }} /> : <EmptyIcon sx={{ fontSize: 16, color: '#c9c7bd' }} />}
                            <Typography sx={{ fontSize: '13px', fontWeight: 600, color: brand.text }}>{p.subject}</Typography>
                            {p.mine && <Box component="span" sx={{ px: 0.6, borderRadius: '5px', fontSize: '10.5px', fontWeight: 700, bgcolor: brand.greenSoft, color: brand.green }}>YOURS</Box>}
                            <Typography sx={{ fontSize: '12px', color: brand.muted, fontVariantNumeric: 'tabular-nums' }}>
                              {p.complete}/{p.students}{p.average !== null ? ` · avg ${p.average}` : ''}
                            </Typography>
                          </ButtonBase>
                        )
                      })}
                    </Box>
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>

          {/* Score sheet */}
          <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
            {!paperId ? (
              <Typography sx={{ color: brand.muted, fontSize: '14px', py: 3, textAlign: 'center' }}>Choose a class subject above to enter its scores.</Typography>
            ) : loadingSheet || !sheet ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>{loadingSheet ? <CircularProgress size={28} /> : null}</Box>
            ) : (
              <>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
                  <Box>
                    <Typography sx={{ fontSize: '16px', fontWeight: 700 }}>{className(sheet.classId)} · {sheet.subject}</Typography>
                    <Typography sx={{ fontSize: '13px', color: brand.muted }}>
                      {sheet.caMax ? `CA out of ${sheet.caMax} + Exam out of ${sheet.examMax} = 100` : 'Exam out of 100'} · {updatedNote()}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={2.5} sx={{ fontVariantNumeric: 'tabular-nums' }}>
                    {[['Average', stats?.avg], ['Highest', stats?.hi], ['Lowest', stats?.lo]].map(([label, v]) => (
                      <Box key={label as string}>
                        <Typography sx={{ fontSize: '12px', color: brand.muted }}>{label}</Typography>
                        <Typography sx={{ fontSize: '18px', fontWeight: 700 }}>{v ?? '—'}</Typography>
                      </Box>
                    ))}
                  </Stack>
                </Stack>

                {sheet.students.length === 0 ? (
                  <Typography sx={{ color: brand.muted, fontSize: '14px', py: 3, textAlign: 'center' }}>
                    {className(sheet.classId)} has no students yet.
                  </Typography>
                ) : (
                  <>
                    <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                      {gradeCounts.map(([g, n]) => (
                        <Box key={g} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.9, py: 0.25, borderRadius: 999, bgcolor: n ? GRADE_STYLE[g].bg : '#f4f3ee', color: n ? GRADE_STYLE[g].fg : brand.subtle, fontSize: '12.5px', fontWeight: 600 }}>
                          {g} <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{n}</Box>
                        </Box>
                      ))}
                      <Typography sx={{ fontSize: '12.5px', color: brand.muted, ml: 0.5 }}>
                        {totals.length} of {sheet.students.length} complete
                      </Typography>
                    </Stack>
                    {!sheet.canEdit && (
                      <Alert severity="info" sx={{ mb: 1.5 }}>View only. You can enter scores only for subjects assigned to you in Class subjects.</Alert>
                    )}
                    {!isPhone && sheet.canEdit && (
                      <Typography sx={{ fontSize: '12.5px', color: brand.subtle, mb: 1 }}>
                        Tip: Enter or ↓ moves down the column. You can paste a column of scores from Excel into the first box.
                      </Typography>
                    )}

                    <Box role="table" aria-label={`Scores for ${sheet.className} ${sheet.subject}`} sx={{ border: `1px solid ${brand.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                      <Box role="row" sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, px: { xs: 1.5, sm: 2 }, py: 1, bgcolor: '#fbfaf6', borderBottom: `1px solid ${brand.border}` }}>
                        <Typography role="columnheader" sx={{ flex: 1, fontSize: '12px', fontWeight: 600, color: brand.muted }}>Student</Typography>
                        {sheet.caMax > 0 && <Typography role="columnheader" sx={{ width: { xs: 56, sm: 72 }, textAlign: 'center', fontSize: '12px', fontWeight: 600, color: brand.muted }}>CA /{sheet.caMax}</Typography>}
                        <Typography role="columnheader" sx={{ width: { xs: 56, sm: 72 }, textAlign: 'center', fontSize: '12px', fontWeight: 600, color: brand.muted }}>Exam /{sheet.examMax}</Typography>
                        <Typography role="columnheader" sx={{ width: { xs: 40, sm: 56 }, textAlign: 'right', fontSize: '12px', fontWeight: 600, color: brand.muted }}>Total</Typography>
                        <Typography role="columnheader" sx={{ width: 34, textAlign: 'center', fontSize: '12px', fontWeight: 600, color: brand.muted }}>Grade</Typography>
                      </Box>
                      {rows.map(({ s, d, total, grade }, i) => (
                        <Box key={s.id} role="row" sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, px: { xs: 1.5, sm: 2 }, py: 0.9, borderTop: i === 0 ? 'none' : `1px solid ${brand.border}` }}>
                          <Box role="cell" sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Typography sx={{ display: { xs: 'none', sm: 'block' }, width: 22, flexShrink: 0, fontSize: '12.5px', color: brand.subtle, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</Typography>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontSize: { xs: '14px', sm: '14.5px' }, fontWeight: 600, lineHeight: 1.3, whiteSpace: { sm: 'nowrap' }, overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.firstName} {s.lastName}</Typography>
                              <Typography noWrap sx={{ fontSize: '12px', color: brand.subtle }}>{s.admissionNumber}</Typography>
                            </Box>
                          </Box>
                          {sheet.caMax > 0 && <Box role="cell">{cell(s.id, i, 'ca', d.ca, sheet.caMax)}</Box>}
                          <Box role="cell">{cell(s.id, i, 'exam', d.exam, sheet.examMax)}</Box>
                          <Typography role="cell" sx={{ width: { xs: 40, sm: 56 }, textAlign: 'right', fontSize: '15px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: total === null ? brand.subtle : brand.text }}>
                            {total ?? '—'}
                          </Typography>
                          <Box role="cell" sx={{ width: 34, display: 'flex', justifyContent: 'center' }}><GradeBadge grade={grade} /></Box>
                        </Box>
                      ))}
                    </Box>

                    {/* Save bar: sticks to the bottom of the screen on phones */}
                    {sheet.canEdit && <Box
                      sx={{
                        position: { xs: 'fixed', md: 'static' }, left: 0, right: 0, bottom: 0, zIndex: 10,
                        bgcolor: { xs: 'rgba(255,255,255,0.97)', md: 'transparent' }, borderTop: { xs: `1px solid ${brand.border}`, md: 'none' },
                        px: { xs: 2, md: 0 }, py: { xs: 1.25, md: 0 }, mt: { md: 2 },
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
                      }}
                    >
                      <Typography sx={{ fontSize: '13px', color: errors ? '#9b2a22' : brand.muted }}>
                        {errors ? `${errors} ${errors === 1 ? 'score needs' : 'scores need'} fixing` : dirty ? `${changed.length} unsaved ${changed.length === 1 ? 'change' : 'changes'}` : 'All changes saved'}
                      </Typography>
                      <Button variant="contained" onClick={handleSave} disabled={saving || !dirty || errors > 0} sx={{ px: 3, minHeight: 42 }}>
                        {saving ? 'Saving…' : 'Save scores'}
                      </Button>
                    </Box>}
                  </>
                )}
              </>
            )}
          </Paper>
        </>
      )}

      <Snackbar open={!!notice} autoHideDuration={3500} onClose={() => setNotice('')} message={notice} />
    </Box>
  )
}
