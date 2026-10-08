import { ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Box, ButtonBase, Grid, IconButton, LinearProgress, Skeleton, Snackbar, Stack, Tooltip, Typography } from '@mui/material'
import {
  PeopleOutlined as PeopleIcon,
  SchoolOutlined as SchoolIcon,
  ClassOutlined as ClassIcon,
  EventAvailableOutlined as AttendanceIcon,
  ChevronRight as ChevronIcon,
  CheckCircle as DoneIcon,
  RadioButtonUnchecked as TodoIcon,
  ContentCopyOutlined as CopyIcon,
  AssignmentOutlined as ExamIcon,
  InsightsOutlined as ResultsIcon,
  MenuBookOutlined as SubjectsIcon,
  PaymentsOutlined as PayIcon,
  PersonAddAlt1Outlined as AddStudentIcon,
  ForumOutlined as MessageIcon,
  CalendarViewWeekOutlined as TimetableIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'
import { Area, areas, brand } from '../theme'
import StudentsByClass from '../components/StudentsByClass'
import { countdown } from '../lib/examsApi'
import { schoolToday } from '../lib/attendanceApi'
import { ACADEMIC_ROLES, ADMIN_ROLES, FINANCE_ROLES } from '../lib/roles'
import { Day, Lesson, Setup, getMyWeek, shortTime } from '../lib/timetableApi'

interface TrendDay { date: string; rate: number | null; classesTaken: number }
interface FeesTerm { term: string; session: string; expected: number; collected: number; outstanding: number; rate: number | null; feesSet: boolean }
interface DashboardStats {
  totalStudents: number
  totalTeachers: number
  totalClasses: number
  totalSubjects: number
  attendanceRate: number
  attendanceToday?: { rate: number | null; classesTaken: number; classesTotal: number }
  attendanceEverTaken?: boolean
  attendanceTrend?: TrendDay[]
  nextExam?: { id: string; name: string; startDate: string; endDate: string; inProgress: boolean } | null
  feesTerm?: FeesTerm | null
  totalExams: number
  totalResults: number
}

const card = {
  bgcolor: brand.surface,
  border: `1px solid ${brand.border}`,
  borderRadius: '14px',
}

const greeting = () => {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

const fmt = (n: number) => n.toLocaleString('en-NG')
/** ₦6.8M, ₦450k, ₦9,500 */
const nairaShort = (n: number) => (n >= 1e6 ? `₦${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M` : n >= 1e4 ? `₦${Math.round(n / 1e3)}k` : `₦${fmt(n)}`)
const dayLabel = (iso: string, style: 'short' | 'long') =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', style === 'short' ? { weekday: 'short' } : { weekday: 'short', day: 'numeric', month: 'short' })

/** A small rounded badge in an area's colour, holding its icon. */
function AreaIcon({ area, children, size = 34 }: { area: Area; children: ReactNode; size?: number }) {
  const a = areas[area]
  return (
    <Box sx={{ width: size, height: size, borderRadius: '10px', bgcolor: a.tint, color: a.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, '& svg': { fontSize: Math.round(size * 0.56) } }}>
      {children}
    </Box>
  )
}

function StatTile({ area, label, value, icon, to, footer }: { area: Area; label: string; value: ReactNode; icon: ReactNode; to: string; footer?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <ButtonBase
      onClick={() => navigate(to)}
      sx={{
        ...card, width: '100%', height: '100%', display: 'block', textAlign: 'left', p: { xs: 2, sm: 2.5 },
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': { borderColor: '#d6d3c9', boxShadow: '0 2px 10px rgba(20,26,21,0.05)' },
        '&:focus-visible': { outline: `2px solid ${brand.green}`, outlineOffset: 2 },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
        <Typography sx={{ fontSize: '13px', fontWeight: 600, color: brand.muted }}>{label}</Typography>
        <AreaIcon area={area}>{icon}</AreaIcon>
      </Stack>
      <Typography sx={{ fontSize: { xs: '26px', sm: '30px' }, fontWeight: 800, color: brand.text, letterSpacing: '-0.6px', mt: 0.5, lineHeight: 1.15, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
      <Box sx={{ mt: 1, minHeight: 18 }}>{footer}</Box>
    </ButtonBase>
  )
}

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{ ...card, p: { xs: 2, sm: 2.5 }, height: '100%' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" spacing={1} sx={{ mb: 1.5 }}>
        <Typography component="h2" sx={{ fontSize: '15px', fontWeight: 700, color: brand.text }}>{title}</Typography>
        {action}
      </Stack>
      {children}
    </Box>
  )
}

function PanelLink({ to, children }: { to: string; children: ReactNode }) {
  const navigate = useNavigate()
  return (
    <ButtonBase onClick={() => navigate(to)} sx={{ fontSize: '13px', fontWeight: 600, color: brand.green, borderRadius: '6px', px: 0.5, flexShrink: 0 }}>
      {children}
    </ButtonBase>
  )
}

/**
 * Attendance rate for each of the last 14 weekdays, as thin columns. One series, so no legend:
 * the title names it. Hover (or focus) a day for its exact figure; a hidden table carries the same numbers for screen readers.
 */
function AttendanceTrend({ days }: { days: TrendDay[] }) {
  const [hover, setHover] = useState<number | null>(null)
  // Drawn at the card's real width so labels stay readable on phones.
  const box = useRef<HTMLDivElement>(null)
  const [W, setW] = useState(640)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const narrow = W < 480
  const H = narrow ? 160 : 180, L = 36, R = 6, T = 8, B = 24
  const plotW = W - L - R, plotH = H - T - B
  const band = plotW / Math.max(1, days.length)
  const barW = Math.min(20, band - 2)
  const y = (v: number) => T + plotH - (v / 100) * plotH
  const recorded = days.filter((d) => d.rate !== null)
  const average = recorded.length ? Math.round(recorded.reduce((a, d) => a + (d.rate ?? 0), 0) / recorded.length) : null
  const h = hover !== null ? days[hover] : null

  return (
    <Box>
      <Typography sx={{ fontSize: '13px', color: brand.muted, mb: 1 }}>
        {average === null
          ? 'No registers taken in the last two weeks.'
          : <>Average <Box component="span" sx={{ color: brand.text, fontWeight: 700 }}>{average}%</Box> present across {recorded.length} school {recorded.length === 1 ? 'day' : 'days'}</>}
      </Typography>
      <Box ref={box} sx={{ position: 'relative' }} onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Attendance rate for the last 14 school days" style={{ display: 'block', overflow: 'visible' }}>
          {[0, 50, 100].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#d9d6cc' : '#efeee8'} strokeWidth={1} />
              <text x={L - 8} y={y(v) + 4} textAnchor="end" fontSize="11" fill={brand.subtle}>{v}%</text>
            </g>
          ))}
          {days.map((d, i) => {
            const cx = L + band * i + band / 2
            const active = hover === i
            const top = d.rate !== null ? y(Math.max(d.rate, 2)) : null
            const r = Math.min(4, barW / 2)
            const x0 = cx - barW / 2, x1 = cx + barW / 2
            return (
              <g key={d.date}>
                {top !== null ? (
                  // Rounded at the data end, square on the baseline.
                  <path
                    d={`M${x0},${y(0)} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x1 - r} Q${x1},${top} ${x1},${top + r} V${y(0)} Z`}
                    fill={areas.attendance.solid}
                    opacity={hover === null || active ? 1 : 0.45}
                  />
                ) : (
                  <line x1={x0 + 2} x2={x1 - 2} y1={y(0) - 2} y2={y(0) - 2} stroke="#d9d6cc" strokeWidth={2} strokeLinecap="round" />
                )}
                <text x={cx} y={H - 6} textAnchor="middle" fontSize="11" fill={active ? brand.text : brand.subtle} fontWeight={active ? 700 : 400}>
                  {dayLabel(d.date, 'short').slice(0, narrow ? 1 : 2)}
                </text>
                {/* Hit target: the whole column, wider and taller than the bar. */}
                <rect
                  x={L + band * i} y={T} width={band} height={plotH + B}
                  fill="transparent" tabIndex={0}
                  aria-label={`${dayLabel(d.date, 'long')}: ${d.rate === null ? 'no register taken' : `${d.rate}% present`}`}
                  onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                  style={{ outline: 'none' }}
                />
              </g>
            )
          })}
        </svg>
        {h && hover !== null && (
          <Box
            role="tooltip"
            sx={{
              position: 'absolute', top: -6, pointerEvents: 'none', whiteSpace: 'nowrap',
              left: `${((L + band * hover + band / 2) / W) * 100}%`,
              // Keep the tooltip inside the card at both ends.
              transform: hover < 2 ? 'translateX(-15%)' : hover > days.length - 3 ? 'translateX(-85%)' : 'translateX(-50%)',
              bgcolor: brand.text, color: '#fff', borderRadius: '8px', px: 1.25, py: 0.75, boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
            }}
          >
            <Typography sx={{ fontSize: '12px', opacity: 0.8 }}>{dayLabel(h.date, 'long')}</Typography>
            <Typography sx={{ fontSize: '13.5px', fontWeight: 700 }}>{h.rate === null ? 'No register taken' : `${h.rate}% present`}</Typography>
            {h.rate !== null && <Typography sx={{ fontSize: '12px', opacity: 0.8 }}>{h.classesTaken} {h.classesTaken === 1 ? 'class' : 'classes'} marked</Typography>}
          </Box>
        )}
      </Box>
      <Box component="table" sx={{ position: 'absolute', width: '1px', height: '1px', overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
        <caption>Attendance rate by day</caption>
        <tbody>
          {days.map((d) => <tr key={d.date}><th scope="row">{dayLabel(d.date, 'long')}</th><td>{d.rate === null ? 'No register' : `${d.rate}%`}</td></tr>)}
        </tbody>
      </Box>
    </Box>
  )
}

/** Collected against expected, as a ring with the figures beside it. */
function FeesRing({ fees }: { fees: FeesTerm }) {
  const pct = Math.max(0, Math.min(100, fees.rate ?? 0))
  const r = 46, c = 2 * Math.PI * r
  const rows: { label: string; value: number; swatch: 'solid' | 'tint' | null }[] = [
    { label: 'Collected', value: fees.collected, swatch: 'solid' },
    { label: 'Still owed', value: fees.outstanding, swatch: 'tint' },
    { label: 'Expected', value: fees.expected, swatch: null },
  ]
  return (
    <Stack direction="row" spacing={2.5} alignItems="center">
      <Box sx={{ position: 'relative', width: 116, height: 116, flexShrink: 0 }}>
        <svg viewBox="0 0 116 116" width="116" height="116" role="img" aria-label={`${pct}% of this term's fees collected`}>
          <circle cx="58" cy="58" r={r} fill="none" stroke={areas.fees.tint} strokeWidth="12" />
          {pct > 0 && (
            <circle cx="58" cy="58" r={r} fill="none" stroke={areas.fees.solid} strokeWidth="12" strokeLinecap="round"
              strokeDasharray={`${(pct / 100) * c} ${c}`} transform="rotate(-90 58 58)" />
          )}
        </svg>
        <Box sx={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <Typography sx={{ fontSize: '22px', fontWeight: 800, color: brand.text, lineHeight: 1 }}>{pct}%</Typography>
          <Typography sx={{ fontSize: '11px', color: brand.subtle, mt: 0.25 }}>collected</Typography>
        </Box>
      </Box>
      <Stack spacing={1.1} sx={{ minWidth: 0 }}>
        {rows.map((row) => (
          <Stack key={row.label} direction="row" spacing={1} alignItems="center">
            <Box sx={{
              width: 10, height: 10, borderRadius: '3px', flexShrink: 0,
              bgcolor: row.swatch ? areas.fees[row.swatch] : 'transparent',
              border: row.swatch === 'solid' ? 'none' : `1.5px solid ${row.swatch === 'tint' ? '#b9cdea' : brand.border}`,
            }} />
            <Typography sx={{ fontSize: '13px', color: brand.muted, width: 76, flexShrink: 0 }}>{row.label}</Typography>
            <Typography sx={{ fontSize: '14px', fontWeight: 700, color: brand.text, fontVariantNumeric: 'tabular-nums' }}>{nairaShort(row.value)}</Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  )
}

// Date.getUTCDay() → timetable day code (Sunday unused).
const DAY_CODE: (Day | null)[] = [null, 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/** What's happening today: registers, the next exam, and (for teachers) their lessons. */
function TodayPanel({ stats, isTeacher }: { stats: DashboardStats; isTeacher: boolean }) {
  const navigate = useNavigate()
  const todayIso = schoolToday()
  const code = DAY_CODE[new Date(`${todayIso}T12:00:00Z`).getUTCDay()]
  const weekend = code === null || code === 'SAT'
  const [week, setWeek] = useState<{ setup: Setup; lessons: Lesson[] } | null>(null)

  useEffect(() => {
    if (!isTeacher || !code) return
    getMyWeek().then((w) => setWeek({ setup: w.setup, lessons: w.lessons })).catch(() => setWeek(null))
  }, [isTeacher, code])

  const periodIndex = (id: string) => week?.setup.periods.findIndex((p) => p.id === id) ?? 0
  const todays = week ? week.lessons.filter((l) => l.day === code).sort((a, b) => periodIndex(a.periodId) - periodIndex(b.periodId)) : []
  const at = stats.attendanceToday

  const Row = ({ area, icon, title, sub, to }: { area: Area; icon: ReactNode; title: ReactNode; sub: ReactNode; to?: string }) => (
    <ButtonBase
      onClick={() => to && navigate(to)} disabled={!to}
      sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, textAlign: 'left', py: 1, px: 1, borderRadius: '10px', '&:hover': { bgcolor: to ? '#f7f6f1' : 'transparent' } }}
    >
      <AreaIcon area={area} size={32}>{icon}</AreaIcon>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: brand.text }}>{title}</Typography>
        <Typography sx={{ fontSize: '12.5px', color: brand.muted }}>{sub}</Typography>
      </Box>
      {to && <ChevronIcon sx={{ fontSize: 18, color: brand.subtle }} />}
    </ButtonBase>
  )

  return (
    <Panel title="Today">
      <Stack spacing={0.25} sx={{ mx: -1 }}>
        {weekend || !at ? (
          <Row area="attendance" icon={<AttendanceIcon />} title="No registers today" sub="Registers are taken Monday to Friday." />
        ) : (
          <Row
            area="attendance" icon={<AttendanceIcon />} to="/attendance"
            title={at.classesTotal === 0 ? 'No classes yet' : at.classesTaken >= at.classesTotal ? 'All registers taken' : `${at.classesTaken} of ${at.classesTotal} registers taken`}
            sub={at.rate !== null ? `${at.rate}% present so far` : 'Take the register to see who is in'}
          />
        )}
        {isTeacher && week && (
          todays.length === 0 ? (
            <Row area="classes" icon={<TimetableIcon />} to="/timetable" title="No lessons today" sub="Your week is on the Timetable page." />
          ) : (
            <Row
              area="classes" icon={<TimetableIcon />} to="/timetable"
              title={`${todays.length} ${todays.length === 1 ? 'lesson' : 'lessons'} today`}
              sub={todays.slice(0, 3).map((l) => {
                const p = week.setup.periods.find((x) => x.id === l.periodId)
                return `${p ? `${shortTime(p.start)} ` : ''}${l.className} ${l.subject}`
              }).join(' · ') + (todays.length > 3 ? ` · +${todays.length - 3} more` : '')}
            />
          )
        )}
        {stats.nextExam ? (
          <Row
            area="exams" icon={<ExamIcon />} to={`/exams/${stats.nextExam.id}`}
            title={stats.nextExam.name}
            sub={`${stats.nextExam.inProgress ? 'In progress' : 'Next exams'} · ${countdown(stats.nextExam, todayIso)}`}
          />
        ) : (
          <Row area="exams" icon={<ExamIcon />} to="/exams" title="No exams scheduled" sub="Plan the next one on the Exams page." />
        )}
      </Stack>
    </Panel>
  )
}

function QuickActions({ role }: { role: string }) {
  const navigate = useNavigate()
  const actions: { label: string; to: string; area: Area; icon: ReactNode; roles: string[] }[] = [
    { label: 'Take attendance', to: '/attendance', area: 'attendance', icon: <AttendanceIcon />, roles: ACADEMIC_ROLES },
    { label: 'Enter scores', to: '/results', area: 'exams', icon: <ResultsIcon />, roles: ACADEMIC_ROLES },
    { label: 'Record payment', to: '/payments', area: 'fees', icon: <PayIcon />, roles: FINANCE_ROLES },
    { label: 'Add student', to: '/students', area: 'students', icon: <AddStudentIcon />, roles: ADMIN_ROLES },
    { label: 'Send message', to: '/messages', area: 'teachers', icon: <MessageIcon />, roles: [...ADMIN_ROLES, 'ACCOUNTANT'] },
  ]
  const shown = actions.filter((a) => a.roles.includes(role))
  if (shown.length === 0) return null
  return (
    <Box
      component="nav" aria-label="Quick actions"
      sx={{ display: 'flex', gap: 1, mb: { xs: 2, md: 2.5 }, overflowX: 'auto', pb: 0.5, mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
    >
      {shown.map((a) => (
        <ButtonBase
          key={a.label} onClick={() => navigate(a.to)}
          sx={{ ...card, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 1, pl: 0.75, pr: 1.75, py: 0.75, borderRadius: '12px', transition: 'border-color 0.15s', '&:hover': { borderColor: areas[a.area].solid } }}
        >
          <AreaIcon area={a.area} size={28}>{a.icon}</AreaIcon>
          <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: brand.text, whiteSpace: 'nowrap' }}>{a.label}</Typography>
        </ButtonBase>
      ))}
    </Box>
  )
}

function ListCard({ title, rows }: { title: string; rows: { label: string; value: number; to: string; area: Area; icon: ReactNode }[] }) {
  const navigate = useNavigate()
  return (
    <Box sx={{ ...card, height: '100%' }}>
      <Typography component="h2" sx={{ px: 2.5, pt: 2.25, pb: 1, fontSize: '15px', fontWeight: 700, color: brand.text }}>{title}</Typography>
      {rows.map((r, i) => (
        <ButtonBase
          key={r.label}
          onClick={() => navigate(r.to)}
          sx={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, px: 2.5, py: 1.25, textAlign: 'left',
            borderTop: i === 0 ? 'none' : `1px solid ${brand.border}`,
            '&:hover': { bgcolor: '#fbfaf7' },
            '&:last-of-type': { borderBottomLeftRadius: '14px', borderBottomRightRadius: '14px' },
          }}
        >
          <AreaIcon area={r.area} size={30}>{r.icon}</AreaIcon>
          <Typography sx={{ flex: 1, fontSize: '14px', fontWeight: 500, color: brand.text }}>{r.label}</Typography>
          <Typography sx={{ fontSize: '15px', fontWeight: 700, color: brand.text, fontVariantNumeric: 'tabular-nums' }}>{fmt(r.value)}</Typography>
          <ChevronIcon sx={{ fontSize: 18, color: brand.subtle }} />
        </ButtonBase>
      ))}
    </Box>
  )
}

export default function Dashboard() {
  const user = useAuthStore((state) => state.user)
  const role = user?.role ?? ''
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api
      .get('/dashboard/stats')
      .then((res) => setStats(res.data.data))
      .catch(() => setFailed(true))
  }, [])

  const copySchoolId = () => {
    if (!user?.schoolId) return
    navigator.clipboard?.writeText(user.schoolId).then(() => setCopied(true)).catch(() => {})
  }

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const isAdmin = ADMIN_ROLES.includes(role)
  const academic = ACADEMIC_ROLES.includes(role)

  // The setup checklist is for the people who set the school up.
  const setupSteps = useMemo(() => (stats && isAdmin
    ? [
        { label: 'Create your classes', done: stats.totalClasses > 0, to: '/classes' },
        { label: 'Add subjects', done: stats.totalSubjects > 0, to: '/subjects' },
        { label: 'Add teachers', done: stats.totalTeachers > 0, to: '/teachers' },
        { label: 'Enrol students', done: stats.totalStudents > 0, to: '/students' },
        { label: 'Take attendance', done: !!stats.attendanceEverTaken || stats.attendanceRate > 0, to: '/attendance' },
        ...(stats.feesTerm ? [{ label: 'Set up fees', done: stats.feesTerm.feesSet, to: '/fees' }] : []),
      ]
    : []), [stats, isAdmin])
  const doneCount = setupSteps.filter((s) => s.done).length
  const showSetup = setupSteps.length > 0 && doneCount < setupSteps.length
  const fees = stats?.feesTerm ?? null
  const at = stats?.attendanceToday

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} spacing={1.5} sx={{ mb: { xs: 2.5, md: 3 } }}>
        <Box>
          <Typography sx={{ fontSize: '13px', color: brand.subtle, mb: 0.5 }}>{today}</Typography>
          <Typography component="h1" sx={{ fontSize: { xs: '24px', sm: '28px' }, fontWeight: 800, letterSpacing: '-0.6px', color: brand.text }}>
            {greeting()}, {user?.firstName}
          </Typography>
          <Typography sx={{ fontSize: '14.5px', color: brand.muted, mt: 0.5 }}>Here's how your school is doing today.</Typography>
        </Box>
        {user?.schoolId && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{ color: brand.subtle }}>
            <Typography sx={{ fontSize: '12.5px' }}>School ID</Typography>
            <Typography sx={{ fontSize: '12.5px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace !important', color: brand.muted, maxWidth: 180 }} noWrap>
              {user.schoolId}
            </Typography>
            <Tooltip title="Copy School ID">
              <IconButton size="small" aria-label="Copy School ID" onClick={copySchoolId} sx={{ color: brand.subtle }}>
                <CopyIcon sx={{ fontSize: 15 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        )}
      </Stack>

      <QuickActions role={role} />

      {failed && (
        <Box sx={{ ...card, p: 2, mb: 3, borderColor: '#f1c2bd', bgcolor: '#fdf6f5' }}>
          <Typography sx={{ fontSize: '14px', color: '#8c1d18' }}>
            We couldn't load your school's numbers right now. Check your connection and refresh the page.
          </Typography>
        </Box>
      )}

      {/* Key numbers */}
      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        {!stats
          ? !failed && [0, 1, 2, 3].map((i) => (
              <Grid item xs={6} md={3} key={i}>
                <Box sx={{ ...card, p: 2.5 }}>
                  <Skeleton width="45%" height={18} />
                  <Skeleton width="35%" height={40} sx={{ mt: 1 }} />
                  <Skeleton width="60%" height={16} sx={{ mt: 1 }} />
                </Box>
              </Grid>
            ))
          : [
              <StatTile key="s" area="students" label="Students" value={fmt(stats.totalStudents)} icon={<PeopleIcon />} to="/students"
                footer={<Typography sx={{ fontSize: '12.5px', color: brand.subtle }}>Currently enrolled</Typography>} />,
              <StatTile key="t" area="teachers" label="Teachers" value={fmt(stats.totalTeachers)} icon={<SchoolIcon />} to="/teachers"
                footer={<Typography sx={{ fontSize: '12.5px', color: brand.subtle }}>
                  {stats.totalTeachers > 0 && stats.totalStudents > 0 ? `1 for every ${Math.round(stats.totalStudents / stats.totalTeachers)} students` : 'On staff'}
                </Typography>} />,
              <StatTile key="c" area="classes" label="Classes" value={fmt(stats.totalClasses)} icon={<ClassIcon />} to="/classes"
                footer={<Typography sx={{ fontSize: '12.5px', color: brand.subtle }}>{stats.totalSubjects} {stats.totalSubjects === 1 ? 'subject' : 'subjects'} offered</Typography>} />,
              <StatTile key="a" area="attendance" label="Attendance today" value={at?.rate != null ? `${at.rate}%` : '—'} icon={<AttendanceIcon />} to="/attendance"
                footer={at && at.classesTaken > 0 ? (
                  <>
                    <LinearProgress variant="determinate" value={Math.min(100, at.rate ?? 0)} aria-label="Attendance today"
                      sx={{ height: 5, borderRadius: 3, mt: 0.25, bgcolor: areas.attendance.tint, '& .MuiLinearProgress-bar': { bgcolor: areas.attendance.solid, borderRadius: 3 } }} />
                    <Typography sx={{ fontSize: '12px', color: brand.subtle, mt: 0.75 }}>{at.classesTaken} of {at.classesTotal} classes marked</Typography>
                  </>
                ) : (
                  <Typography sx={{ fontSize: '12.5px', color: brand.subtle }}>No registers taken yet today</Typography>
                )} />,
            ].map((tile) => (
              <Grid item xs={6} md={3} key={tile.key}>
                {tile}
              </Grid>
            ))}
      </Grid>

      {stats && (
        <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ pt: { xs: 1.5, sm: 2 } }}>
          {/* Setup checklist, only until the basics are in place */}
          {showSetup && (
            <Grid item xs={12}>
              <Box sx={{ ...card, p: { xs: 2, sm: 2.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.5 }}>
                  <Typography component="h2" sx={{ fontSize: '15px', fontWeight: 700, color: brand.text }}>Finish setting up your school</Typography>
                  <Typography sx={{ fontSize: '13px', color: brand.muted }}>{doneCount} of {setupSteps.length} done</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={(doneCount / setupSteps.length) * 100}
                  sx={{ height: 5, borderRadius: 3, mb: 1.5, bgcolor: '#efeee8', '& .MuiLinearProgress-bar': { bgcolor: brand.green, borderRadius: 3 } }} />
                <Grid container spacing={0.5}>
                  {setupSteps.map((s) => (
                    <Grid item xs={12} sm={6} md={4} key={s.label}>
                      <ButtonBase onClick={() => navigate(s.to)} disabled={s.done}
                        sx={{ width: '100%', justifyContent: 'flex-start', gap: 1.25, px: 1, py: 1, borderRadius: '10px', '&:hover': { bgcolor: '#f7f6f1' } }}>
                        {s.done ? <DoneIcon sx={{ fontSize: 19, color: brand.accent }} /> : <TodoIcon sx={{ fontSize: 19, color: '#c9c7bd' }} />}
                        <Typography sx={{ fontSize: '14px', color: s.done ? brand.subtle : brand.text, textDecoration: s.done ? 'line-through' : 'none' }}>
                          {s.label}
                        </Typography>
                      </ButtonBase>
                    </Grid>
                  ))}
                </Grid>
              </Box>
            </Grid>
          )}

          {/* Attendance trend beside today's agenda (accountants don't see attendance) */}
          {academic && (
            <Grid item xs={12} md={8}>
              <Panel title="Attendance · last 2 weeks" action={<PanelLink to="/attendance">Registers</PanelLink>}>
                <AttendanceTrend days={stats.attendanceTrend ?? []} />
              </Panel>
            </Grid>
          )}
          {academic && (
            <Grid item xs={12} md={4}>
              <TodayPanel stats={stats} isTeacher={role === 'TEACHER'} />
            </Grid>
          )}

          {fees && (
            <Grid item xs={12} md={academic ? 5 : 6}>
              <Panel title="Fees this term" action={<PanelLink to="/fees">See who owes</PanelLink>}>
                {fees.feesSet ? <FeesRing fees={fees} /> : (
                  <Typography sx={{ fontSize: '14px', color: brand.muted }}>Fees aren't set for this term yet. Set them on the Fees page to track what's been collected.</Typography>
                )}
              </Panel>
            </Grid>
          )}

          <Grid item xs={12} md={fees ? (academic ? 7 : 6) : 12}>
            <ListCard
              title="Academics"
              rows={[
                { label: 'Subjects', value: stats.totalSubjects, to: '/subjects', area: 'classes', icon: <SubjectsIcon /> },
                { label: 'Exam papers', value: stats.totalExams, to: '/exams', area: 'exams', icon: <ExamIcon /> },
                { label: 'Results recorded', value: stats.totalResults, to: '/results', area: 'exams', icon: <ResultsIcon /> },
              ]}
            />
          </Grid>

          <Grid item xs={12}>
            <StudentsByClass />
          </Grid>
        </Grid>
      )}

      <Snackbar open={copied} autoHideDuration={2000} onClose={() => setCopied(false)} message="School ID copied" />
    </Box>
  )
}
