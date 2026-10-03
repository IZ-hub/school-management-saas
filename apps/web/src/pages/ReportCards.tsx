import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Chip,
  CircularProgress,
  GlobalStyles,
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
import { PrintOutlined as PrintIcon, WarningAmberRounded as MissingIcon, ChevronLeft, ChevronRight, VisibilityOutlined as PublishIcon, CheckCircleRounded as PublishedIcon } from '@mui/icons-material'
import { api } from '../lib/api'
import { classLabels } from '../lib/classLabels'
import { ExamSeries, listSeries, setPublished } from '../lib/examsApi'
import { ClassReport, ReportCard, getClassReport, ordinal, saveRemarks, suggestRemarks } from '../lib/reportCardsApi'
import { useAuthStore } from '../store/authStore'
import CardSheet from '../components/ReportCardSheet'
import { MyScope, UNLINKED_MESSAGE, getMyScope } from '../lib/scopeApi'
import { brand } from '../theme'

const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL', 'VICE_PRINCIPAL']

interface ClassRow { id: string; name: string; status?: string; createdAt?: unknown }

const dash = (v: number | null | undefined) => (v === null || v === undefined ? '–' : String(v))

export default function ReportCards() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'))
  const isAdmin = ADMIN_ROLES.includes(useAuthStore((s) => s.user?.role) ?? '')
  const [params, setParams] = useSearchParams()
  const seriesId = params.get('exam') ?? ''
  const classId = params.get('class') ?? ''
  const studentId = params.get('student') ?? ''

  const [series, setSeries] = useState<ExamSeries[] | null>(null)
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [scope, setScope] = useState<MyScope | null>(null)
  const [report, setReport] = useState<ClassReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [teacherRemark, setTeacherRemark] = useState('')
  const [principalRemark, setPrincipalRemark] = useState('')
  const [savingRemarks, setSavingRemarks] = useState(false)
  const [printing, setPrinting] = useState<'one' | 'all' | null>(null)

  const labels = useMemo(() => classLabels(classes), [classes])
  const className = (id: string) => labels.get(id) ?? classes.find((c) => c.id === id)?.name ?? 'Class'

  const setParam = (changes: Record<string, string>, replace = true) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace })
  }

  useEffect(() => {
    api.get('/classes').then((r) => setClasses(r.data.data)).catch(() => {})
    getMyScope().then(setScope).catch(() => {})
    listSeries()
      .then((list) => setSeries([...list].sort((a, b) => b.startDate.localeCompare(a.startDate))))
      .catch(() => { setSeries([]); setError('Failed to load exams') })
  }, [])

  const current = series?.find((s) => s.id === seriesId)
  const seriesClasses = useMemo(
    () => (current && scope ? [...current.classIds].filter((id) => classes.some((c) => c.id === id && c.status !== 'INACTIVE') && (scope.all || scope.classIds.includes(id))).sort((a, b) => className(a).localeCompare(className(b), undefined, { numeric: true })) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [current, classes, labels, scope],
  )

  // Defaults: the exam in progress (else the latest), then its first class.
  useEffect(() => {
    if (!series || series.length === 0) return
    if (!seriesId) {
      const pick = series.find((s) => s.status === 'IN_PROGRESS') ?? series[0]
      setParam({ exam: pick.id })
    } else if (!classId && seriesClasses.length) {
      setParam({ class: seriesClasses[0] })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, seriesId, classId, seriesClasses])

  useEffect(() => {
    if (!seriesId || !classId) { setReport(null); return }
    setLoading(true)
    setError('')
    getClassReport(seriesId, classId)
      .then(setReport)
      .catch((err) => { setReport(null); setError(err.response?.data?.message || 'Failed to load report cards') })
      .finally(() => setLoading(false))
  }, [seriesId, classId])

  // Cards in class order (by position, unranked last), which is how schools usually review them.
  const ordered = useMemo(
    () => (report ? [...report.cards].sort((a, b) => (a.position ?? 1e9) - (b.position ?? 1e9) || a.student.lastName.localeCompare(b.student.lastName)) : []),
    [report],
  )
  const card = ordered.find((c) => c.student.id === studentId) ?? ordered[0] ?? null
  const index = card ? ordered.indexOf(card) : -1

  useEffect(() => {
    setTeacherRemark(card?.teacherRemark ?? '')
    setPrincipalRemark(card?.principalRemark ?? '')
  }, [card?.student.id, card?.teacherRemark, card?.principalRemark])

  const remarksDirty = !!card && ((report?.canRemark !== false && teacherRemark.trim() !== card.teacherRemark) || (isAdmin && principalRemark.trim() !== card.principalRemark))
  const incomplete = ordered.filter((c) => c.subjectsScored < c.subjectsTotal).length
  const remarksDone = ordered.filter((c) => c.teacherRemark).length

  const goTo = (c: ReportCard | undefined) => {
    if (!c) return
    if (remarksDirty && !window.confirm('You have unsaved remarks. Leave without saving?')) return
    setParam({ student: c.student.id })
  }

  const handleSaveRemarks = async (thenNext = false) => {
    if (!card || !report) return
    setSavingRemarks(true)
    try {
      const saved = await saveRemarks({
        seriesId: report.series.id,
        studentId: card.student.id,
        ...(report.canRemark !== false ? { teacherRemark } : {}),
        ...(isAdmin ? { principalRemark } : {}),
      })
      setReport({ ...report, cards: report.cards.map((c) => (c.student.id === card.student.id ? { ...c, ...saved } : c)) })
      setNotice(`Remarks saved for ${card.student.firstName}`)
      if (thenNext && ordered[index + 1]) setParam({ student: ordered[index + 1].student.id })
    } catch (err: any) {
      const msg = err.response?.data?.message
      setError(Array.isArray(msg) ? msg[0] : msg || 'Failed to save remarks')
    } finally {
      setSavingRemarks(false)
    }
  }

  const [publishing, setPublishing] = useState(false)
  const togglePublish = async () => {
    if (!current) return
    const next = !current.resultsPublished
    const msg = next
      ? `Publish ${current.name} report cards? Parents with access will be able to see their child's card for every class in this exam.`
      : `Hide ${current.name} report cards from parents?`
    if (!window.confirm(msg)) return
    setPublishing(true)
    try {
      await setPublished(current.id, next)
      setSeries((list) => list?.map((s) => (s.id === current.id ? { ...s, resultsPublished: next } : s)) ?? null)
      setNotice(next ? 'Report cards are now visible to parents' : 'Report cards hidden from parents')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update')
    } finally {
      setPublishing(false)
    }
  }

  // Render the print copy, let it paint, then open the print dialog.
  const print = (mode: 'one' | 'all') => {
    setPrinting(mode)
    setTimeout(() => {
      window.print()
      setPrinting(null)
    }, 300)
  }

  const studentList = (
    <Box role="listbox" aria-label="Students" sx={{ border: `1px solid ${brand.border}`, borderRadius: '12px', overflow: 'hidden', maxHeight: { md: 640 }, overflowY: 'auto' }}>
      {ordered.map((c, i) => {
        const on = c === card
        return (
          <ButtonBase
            key={c.student.id}
            role="option"
            aria-selected={on}
            onClick={() => goTo(c)}
            sx={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 1.25, px: 1.5, py: 1, textAlign: 'left',
              borderTop: i === 0 ? 'none' : `1px solid ${brand.border}`, bgcolor: on ? brand.greenSoft : brand.surface,
              boxShadow: on ? `inset 3px 0 0 ${brand.green}` : 'none', '&:hover': { bgcolor: on ? brand.greenSoft : '#f7f6f1' },
            }}
          >
            <Typography sx={{ width: 34, flexShrink: 0, fontSize: '12.5px', fontWeight: 700, color: c.position ? brand.text : brand.subtle, fontVariantNumeric: 'tabular-nums' }}>
              {c.position ? ordinal(c.position) : '–'}
            </Typography>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontSize: '14px', fontWeight: 600 }}>{c.student.firstName} {c.student.lastName}</Typography>
              <Typography noWrap sx={{ fontSize: '12px', color: c.subjectsScored < c.subjectsTotal ? '#7a4c00' : brand.subtle }}>
                {c.subjectsScored < c.subjectsTotal ? `${c.subjectsTotal - c.subjectsScored} missing ${c.subjectsTotal - c.subjectsScored === 1 ? 'score' : 'scores'}` : c.teacherRemark ? 'Remark added' : 'No remark yet'}
              </Typography>
            </Box>
            <Typography sx={{ fontSize: '13.5px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{dash(c.average)}</Typography>
          </ButtonBase>
        )
      })}
    </Box>
  )

  return (
    <>
      <Box sx={{ flexGrow: 1, maxWidth: 1240, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
        <GlobalStyles
          styles={{
            '.rc-print-root': { display: 'none' },
            '@media print': {
              '@page': { size: 'A4', margin: '10mm' },
              'body > *:not(.rc-print-root)': { display: 'none !important' },
              'body': { background: '#fff !important' },
              '.rc-print-root': { display: 'block !important' },
              '.rc-page': { breakAfter: 'page', pageBreakAfter: 'always' },
              '.rc-page:last-child': { breakAfter: 'auto', pageBreakAfter: 'auto' },
              '*': { printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' },
            },
          }}
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-start' }} spacing={2} sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h4">Report cards</Typography>
            <Typography sx={{ color: brand.muted, fontSize: '14.5px' }}>Check each student's report, add remarks, then print.</Typography>
          </Box>
          {report && ordered.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {isAdmin && current && (
                <Button variant={current.resultsPublished ? 'outlined' : 'text'} startIcon={current.resultsPublished ? <PublishedIcon /> : <PublishIcon />} disabled={publishing}
                  onClick={togglePublish} sx={current.resultsPublished ? { color: '#1d5f36', borderColor: '#9fcdab' } : undefined}>
                  {current.resultsPublished ? 'Visible to parents' : 'Publish to parents'}
                </Button>
              )}
              <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => print('one')} disabled={!!printing}>Print card</Button>
              <Button variant="contained" startIcon={<PrintIcon />} onClick={() => print('all')} disabled={!!printing}>Print all ({ordered.length})</Button>
            </Stack>
          )}
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {scope && !scope.linked && <Alert severity="info" sx={{ mb: 2 }}>{UNLINKED_MESSAGE}</Alert>}

        {!series ? (
          <Skeleton variant="rounded" height={120} />
        ) : series.length === 0 ? (
          <Paper sx={{ p: { xs: 3, sm: 4 }, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '16px', fontWeight: 700, mb: 0.75 }}>No exams yet</Typography>
            <Typography sx={{ fontSize: '14px', color: brand.muted, mb: 2.5 }}>Report cards are made from an exam's results. Create the exam and enter scores first.</Typography>
            <Button variant="contained" onClick={() => navigate('/exams')}>Go to Exams</Button>
          </Paper>
        ) : (
          <>
            <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
                <TextField select size="small" label="Exam" value={seriesId} onChange={(e) => setParam({ exam: e.target.value, class: '', student: '' })} sx={{ width: { xs: '100%', sm: 340 } }}>
                  {series.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
                </TextField>
                <TextField select size="small" label="Class" value={seriesClasses.includes(classId) ? classId : ''} onChange={(e) => setParam({ class: e.target.value, student: '' })}
                  SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }} sx={{ width: { xs: '100%', sm: 200 } }}>
                  {seriesClasses.length === 0 && <MenuItem value="" disabled>No classes</MenuItem>}
                  {seriesClasses.map((c) => <MenuItem key={c} value={c}>{className(c)}</MenuItem>)}
                </TextField>
                {report && (
                  <Stack direction="row" spacing={2.5} sx={{ pl: { md: 1.5 }, fontVariantNumeric: 'tabular-nums' }} flexWrap="wrap" useFlexGap>
                    <Typography sx={{ fontSize: '13.5px', color: brand.muted }}><Box component="span" sx={{ color: brand.text, fontWeight: 600 }}>{report.classSize}</Box> students</Typography>
                    <Typography sx={{ fontSize: '13.5px', color: brand.muted }}>Class average <Box component="span" sx={{ color: brand.text, fontWeight: 600 }}>{dash(report.classAverage)}</Box></Typography>
                    <Typography sx={{ fontSize: '13.5px', color: brand.muted }}><Box component="span" sx={{ color: brand.text, fontWeight: 600 }}>{remarksDone}</Box> of {report.classSize} remarks</Typography>
                  </Stack>
                )}
              </Stack>
              {report && incomplete > 0 && (
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5, color: '#7a4c00' }}>
                  <MissingIcon sx={{ fontSize: 17 }} />
                  <Typography sx={{ fontSize: '13.5px' }}>
                    {incomplete} {incomplete === 1 ? 'student has' : 'students have'} missing scores.{' '}
                    <ButtonBase onClick={() => navigate(`/results?exam=${seriesId}`)} sx={{ fontSize: 'inherit', fontWeight: 600, color: brand.green, verticalAlign: 'baseline' }}>Enter them in Results</ButtonBase>
                  </Typography>
                </Stack>
              )}
            </Paper>

            {loading || (!report && classId) ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>
            ) : !report ? null : ordered.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography sx={{ color: brand.muted, fontSize: '14px' }}>{report.class.name} has no students yet.</Typography>
              </Paper>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '280px 1fr' }, gap: 2, alignItems: 'start' }}>
                {isDesktop ? studentList : (
                  <TextField select size="small" label="Student" value={card?.student.id ?? ''} onChange={(e) => goTo(ordered.find((c) => c.student.id === e.target.value))}>
                    {ordered.map((c) => <MenuItem key={c.student.id} value={c.student.id}>{c.position ? `${ordinal(c.position)} · ` : ''}{c.student.firstName} {c.student.lastName}</MenuItem>)}
                  </TextField>
                )}

                {card && (
                  <Stack spacing={2} sx={{ minWidth: 0 }}>
                    {/* Remarks */}
                    <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                        <Typography sx={{ fontSize: '15px', fontWeight: 700 }}>Remarks · {card.student.firstName} {card.student.lastName}</Typography>
                        <Stack direction="row" spacing={0.5}>
                          <Button size="small" startIcon={<ChevronLeft />} disabled={index <= 0} onClick={() => goTo(ordered[index - 1])} sx={{ minWidth: 0 }}>Prev</Button>
                          <Button size="small" endIcon={<ChevronRight />} disabled={index >= ordered.length - 1} onClick={() => goTo(ordered[index + 1])} sx={{ minWidth: 0 }}>Next</Button>
                        </Stack>
                      </Stack>
                      <Stack spacing={1.5}>
                        <RemarkField label="Class teacher's remark" value={teacherRemark} onChange={setTeacherRemark} suggestions={suggestRemarks(card.average)}
                        disabled={report.canRemark === false} helper={report.canRemark === false ? "Only this class's form teacher can write this." : undefined} />
                        <RemarkField label="Principal's remark" value={principalRemark} onChange={setPrincipalRemark} suggestions={suggestRemarks(card.average)}
                          disabled={!isAdmin} helper={isAdmin ? undefined : 'Only the principal or school admin can write this.'} />
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button onClick={() => handleSaveRemarks(false)} disabled={!remarksDirty || savingRemarks}>Save</Button>
                          <Button variant="contained" onClick={() => handleSaveRemarks(true)} disabled={!remarksDirty || savingRemarks || index >= ordered.length - 1}>
                            {savingRemarks ? 'Saving…' : 'Save and next'}
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>

                    {/* Preview */}
                    <Box sx={{ overflowX: 'auto', border: `1px solid ${brand.border}`, borderRadius: '12px', bgcolor: '#fff', boxShadow: '0 2px 12px rgba(20,26,21,0.05)' }}>
                      <Box sx={{ minWidth: 680, p: { xs: 2.5, sm: 4 } }}>
                        <CardSheet report={report} card={{ ...card, teacherRemark: teacherRemark.trim(), principalRemark: principalRemark.trim() }} />
                      </Box>
                    </Box>
                  </Stack>
                )}
              </Box>
            )}
          </>
        )}

        <Snackbar open={!!notice} autoHideDuration={2500} onClose={() => setNotice('')} message={notice} />
      </Box>

      {printing && report && createPortal(
        <div className="rc-print-root">
          {(printing === 'all' ? ordered : card ? [card] : []).map((c) => (
            <div className="rc-page" key={c.student.id}><CardSheet report={report} card={c} /></div>
          ))}
        </div>,
        document.body,
      )}
    </>
  )
}

function RemarkField({ label, value, onChange, suggestions, disabled, helper }: {
  label: string; value: string; onChange: (v: string) => void; suggestions: string[]; disabled?: boolean; helper?: string
}) {
  return (
    <Box>
      <TextField label={label} value={value} onChange={(e) => onChange(e.target.value)} fullWidth multiline minRows={2} disabled={disabled}
        inputProps={{ maxLength: 300 }} helperText={helper ?? `${value.length}/300`} />
      {!disabled && suggestions.length > 0 && (
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.75 }}>
          {suggestions.map((s) => (
            <Chip key={s} label={s} size="small" variant="outlined" onClick={() => onChange(s)}
              sx={{ fontSize: '12.5px', borderColor: brand.border, color: brand.muted, '&:hover': { borderColor: brand.green, color: brand.text } }} />
          ))}
        </Stack>
      )}
    </Box>
  )
}
