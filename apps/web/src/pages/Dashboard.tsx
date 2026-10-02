import { ReactNode, useEffect, useState } from 'react'
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
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'
import { brand } from '../theme'
import StudentsByClass from '../components/StudentsByClass'
import { countdown } from '../lib/examsApi'
import { schoolToday } from '../lib/attendanceApi'

interface DashboardStats {
  totalStudents: number
  totalTeachers: number
  totalClasses: number
  totalSubjects: number
  attendanceRate: number
  attendanceToday?: { rate: number | null; classesTaken: number; classesTotal: number }
  attendanceEverTaken?: boolean
  nextExam?: { id: string; name: string; startDate: string; endDate: string; inProgress: boolean } | null
  totalExams: number
  totalResults: number
  totalFees: number
  totalPayments: number
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

function StatTile({ label, value, icon, to, footer }: { label: string; value: ReactNode; icon: ReactNode; to: string; footer?: ReactNode }) {
  const navigate = useNavigate()
  return (
    <ButtonBase
      onClick={() => navigate(to)}
      sx={{
        ...card, width: '100%', height: '100%', display: 'block', textAlign: 'left', p: { xs: 2, sm: 2.5 },
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': { borderColor: '#d6d3c9', boxShadow: '0 2px 10px rgba(20,26,21,0.04)' },
        '&:focus-visible': { outline: `2px solid ${brand.green}`, outlineOffset: 2 },
      }}
    >
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Typography sx={{ fontSize: '13px', fontWeight: 500, color: brand.muted }}>{label}</Typography>
        <Box sx={{ color: brand.subtle, display: 'flex', '& svg': { fontSize: 19 } }}>{icon}</Box>
      </Stack>
      <Typography sx={{ fontSize: { xs: '26px', sm: '30px' }, fontWeight: 700, color: brand.text, letterSpacing: '-0.6px', mt: 1, lineHeight: 1.15 }}>
        {value}
      </Typography>
      <Box sx={{ mt: 1.25, minHeight: 18 }}>{footer}</Box>
    </ButtonBase>
  )
}

function ListCard({ title, rows }: { title: string; rows: { label: string; value: number; to: string; hint?: string }[] }) {
  const navigate = useNavigate()
  return (
    <Box sx={{ ...card, height: '100%' }}>
      <Typography sx={{ px: 2.5, pt: 2.25, pb: 1, fontSize: '15px', fontWeight: 700, color: brand.text }}>{title}</Typography>
      {rows.map((r, i) => (
        <ButtonBase
          key={r.label}
          onClick={() => navigate(r.to)}
          sx={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 2, px: 2.5, py: 1.5, textAlign: 'left',
            borderTop: i === 0 ? 'none' : `1px solid ${brand.border}`,
            '&:hover': { bgcolor: '#fbfaf7' },
            '&:last-of-type': { borderBottomLeftRadius: '14px', borderBottomRightRadius: '14px' },
          }}
        >
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 500, color: brand.text }}>{r.label}</Typography>
            {r.hint && <Typography sx={{ fontSize: '12.5px', color: brand.subtle }}>{r.hint}</Typography>}
          </Box>
          <Typography sx={{ fontSize: '15px', fontWeight: 700, color: brand.text }}>{fmt(r.value)}</Typography>
          <ChevronIcon sx={{ fontSize: 18, color: brand.subtle }} />
        </ButtonBase>
      ))}
    </Box>
  )
}

export default function Dashboard() {
  const user = useAuthStore((state) => state.user)
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

  const setupSteps = stats
    ? [
        { label: 'Create your classes', done: stats.totalClasses > 0, to: '/classes' },
        { label: 'Add subjects', done: stats.totalSubjects > 0, to: '/subjects' },
        { label: 'Add teachers', done: stats.totalTeachers > 0, to: '/teachers' },
        { label: 'Enrol students', done: stats.totalStudents > 0, to: '/students' },
        { label: 'Take attendance', done: !!stats.attendanceEverTaken || stats.attendanceRate > 0, to: '/attendance' },
        { label: 'Set up fees', done: stats.totalFees > 0, to: '/fees' },
      ]
    : []
  const doneCount = setupSteps.filter((s) => s.done).length
  const setupComplete = setupSteps.length > 0 && doneCount === setupSteps.length

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      {/* Header */}
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'flex-end' }} spacing={1.5} sx={{ mb: { xs: 3, md: 4 } }}>
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

      {failed && (
        <Box sx={{ ...card, p: 2, mb: 3, borderColor: '#f1c2bd', bgcolor: '#fdf6f5' }}>
          <Typography sx={{ fontSize: '14px', color: '#8c1d18' }}>
            We couldn't load your school's numbers right now. Check your connection and refresh the page.
          </Typography>
        </Box>
      )}

      {/* Key numbers */}
      <Grid container spacing={{ xs: 1.5, sm: 2 }}>
        {!stats && !failed
          ? [0, 1, 2, 3].map((i) => (
              <Grid item xs={6} md={3} key={i}>
                <Box sx={{ ...card, p: 2.5 }}>
                  <Skeleton width="45%" height={18} />
                  <Skeleton width="35%" height={40} sx={{ mt: 1 }} />
                  <Skeleton width="60%" height={16} sx={{ mt: 1 }} />
                </Box>
              </Grid>
            ))
          : stats && [
              <StatTile key="s" label="Students" value={fmt(stats.totalStudents)} icon={<PeopleIcon />} to="/students"
                footer={<Typography sx={{ fontSize: '12.5px', color: brand.subtle }}>Active enrolments</Typography>} />,
              <StatTile key="t" label="Teachers" value={fmt(stats.totalTeachers)} icon={<SchoolIcon />} to="/teachers"
                footer={<Typography sx={{ fontSize: '12.5px', color: brand.subtle }}>On staff</Typography>} />,
              <StatTile key="c" label="Classes" value={fmt(stats.totalClasses)} icon={<ClassIcon />} to="/classes"
                footer={<Typography sx={{ fontSize: '12.5px', color: brand.subtle }}>{stats.totalSubjects} subjects offered</Typography>} />,
              <StatTile key="a" label="Attendance today" value={stats.attendanceToday?.rate != null ? `${stats.attendanceToday.rate}%` : '—'} icon={<AttendanceIcon />} to="/attendance"
                footer={
                  stats.attendanceToday && stats.attendanceToday.classesTaken > 0 ? (
                    <>
                      <LinearProgress variant="determinate" value={Math.min(100, stats.attendanceToday.rate ?? 0)} aria-label="Attendance today"
                        sx={{ height: 5, borderRadius: 3, mt: 0.25, bgcolor: '#efeee8', '& .MuiLinearProgress-bar': { bgcolor: brand.accent, borderRadius: 3 } }} />
                      <Typography sx={{ fontSize: '12px', color: brand.subtle, mt: 0.75 }}>
                        {stats.attendanceToday.classesTaken} of {stats.attendanceToday.classesTotal} classes marked
                      </Typography>
                    </>
                  ) : (
                    <Typography sx={{ fontSize: '12.5px', color: brand.subtle }}>No registers taken yet today</Typography>
                  )
                } />,
            ].map((tile) => (
              <Grid item xs={6} md={3} key={tile.key}>
                {tile}
              </Grid>
            ))}
      </Grid>

      {stats && (
        <Grid container spacing={{ xs: 1.5, sm: 2 }} sx={{ mt: { xs: 0, sm: 0.5 } }}>
          {/* Setup checklist, only until the basics are in place */}
          {!setupComplete && (
            <Grid item xs={12}>
              <Box sx={{ ...card, p: { xs: 2, sm: 2.5 } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1.5 }}>
                  <Typography sx={{ fontSize: '15px', fontWeight: 700, color: brand.text }}>Finish setting up your school</Typography>
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

          {stats.nextExam && (
            <Grid item xs={12}>
              <ButtonBase
                onClick={() => navigate(`/exams/${stats.nextExam!.id}`)}
                sx={{ ...card, width: '100%', justifyContent: 'flex-start', gap: 1.5, px: { xs: 2, sm: 2.5 }, py: 1.5, textAlign: 'left', '&:hover': { borderColor: '#d6d3c9' } }}
              >
                <ExamIcon sx={{ fontSize: 20, color: brand.green }} />
                <Typography sx={{ flex: 1, fontSize: '14px', color: brand.text }}>
                  <Box component="span" sx={{ color: brand.muted }}>{stats.nextExam.inProgress ? 'Exams in progress' : 'Upcoming exams'} · </Box>
                  <Box component="span" sx={{ fontWeight: 600 }}>{stats.nextExam.name}</Box>
                  <Box component="span" sx={{ color: brand.muted }}> · {countdown(stats.nextExam, schoolToday())}</Box>
                </Typography>
                <ChevronIcon sx={{ color: brand.subtle }} />
              </ButtonBase>
            </Grid>
          )}

          <Grid item xs={12}>
            <StudentsByClass />
          </Grid>

          <Grid item xs={12} md={6}>
            <ListCard
              title="Academics"
              rows={[
                { label: 'Subjects', value: stats.totalSubjects, to: '/subjects' },
                { label: 'Exam papers', value: stats.totalExams, to: '/exams' },
                { label: 'Results recorded', value: stats.totalResults, to: '/results' },
              ]}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <ListCard
              title="Finance"
              rows={[
                { label: 'Fee records', value: stats.totalFees, to: '/fees', hint: 'Fees set for students this session' },
                { label: 'Payments recorded', value: stats.totalPayments, to: '/payments' },
              ]}
            />
          </Grid>
        </Grid>
      )}

      <Snackbar open={copied} autoHideDuration={2000} onClose={() => setCopied(false)} message="School ID copied" />
    </Box>
  )
}
