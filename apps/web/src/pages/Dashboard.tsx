import { useEffect, useState } from 'react'
import { Box, Typography, Grid, Card, CardContent, CardActionArea, CircularProgress, Chip, Tooltip, IconButton, Snackbar } from '@mui/material'
import {
  People as PeopleIcon,
  School as SchoolIcon,
  Class as ClassIcon,
  MenuBook as SubjectsIcon,
  EventNote as AttendanceIcon,
  Assignment as ExamsIcon,
  Assessment as ResultsIcon,
  Payment as FeesIcon,
  Receipt as PaymentsIcon,
  ContentCopy as CopyIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'

interface DashboardStats {
  totalStudents: number
  totalTeachers: number
  totalClasses: number
  totalSubjects: number
  attendanceRate: number
  totalExams: number
  totalResults: number
  totalFees: number
  totalPayments: number
}

export default function Dashboard() {
  const user = useAuthStore((state) => state.user)
  const navigate = useNavigate()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const copySchoolId = () => {
    if (user?.schoolId) {
      navigator.clipboard.writeText(user.schoolId)
      setCopied(true)
    }
  }

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await api.get('/dashboard/stats')
        setStats(response.data.data)
      } catch {
        // Fallback to zeros if API fails
        setStats({
          totalStudents: 0,
          totalTeachers: 0,
          totalClasses: 0,
          totalSubjects: 0,
          attendanceRate: 0,
          totalExams: 0,
          totalResults: 0,
          totalFees: 0,
          totalPayments: 0,
        })
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const cards = [
    { label: 'Students', value: stats?.totalStudents, path: '/students', icon: <PeopleIcon sx={{ fontSize: 40, color: '#8bc34a' }} />, color: '#f1f8e9' },
    { label: 'Teachers', value: stats?.totalTeachers, path: '/teachers', icon: <SchoolIcon sx={{ fontSize: 40, color: '#7cb342' }} />, color: '#e8f5e9' },
    { label: 'Classes', value: stats?.totalClasses, path: '/classes', icon: <ClassIcon sx={{ fontSize: 40, color: '#689f38' }} />, color: '#f1f8e9' },
    { label: 'Subjects', value: stats?.totalSubjects, path: '/subjects', icon: <SubjectsIcon sx={{ fontSize: 40, color: '#9c27b0' }} />, color: '#f3e5f5' },
    { label: 'Attendance', value: stats ? `${stats.attendanceRate}%` : '—', path: '/attendance', icon: <AttendanceIcon sx={{ fontSize: 40, color: '#558b2f' }} />, color: '#f1f8e9' },
    { label: 'Exams', value: stats?.totalExams, path: '/exams', icon: <ExamsIcon sx={{ fontSize: 40, color: '#d32f2f' }} />, color: '#ffebee' },
    { label: 'Results', value: stats?.totalResults, path: '/results', icon: <ResultsIcon sx={{ fontSize: 40, color: '#33691e' }} />, color: '#f1f8e9' },
    { label: 'Fees', value: stats?.totalFees, path: '/fees', icon: <FeesIcon sx={{ fontSize: 40, color: '#f57c00' }} />, color: '#fff8e1' },
    { label: 'Payments', value: stats?.totalPayments, path: '/payments', icon: <PaymentsIcon sx={{ fontSize: 40, color: '#5c6bc0' }} />, color: '#e8eaf6' },
  ]

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 0.5 }}>
        Dashboard
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Welcome back, {user?.firstName} {user?.lastName}
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Typography variant="body2" color="text.secondary">
          School ID:
        </Typography>
        <Chip
          label={user?.schoolId}
          size="small"
          variant="outlined"
          sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
        />
        <Tooltip title="Copy School ID">
          <IconButton size="small" onClick={copySchoolId}>
            <CopyIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Tooltip>
      </Box>
      <Snackbar
        open={copied}
        autoHideDuration={2000}
        onClose={() => setCopied(false)}
        message="School ID copied to clipboard"
      />

      <Grid container spacing={2.5}>
        {cards.map((card) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={card.path}>
            <Card elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
              <CardActionArea onClick={() => navigate(card.path)}>
                <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Box
                    sx={{
                      width: 56,
                      height: 56,
                      borderRadius: 2,
                      bgcolor: card.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      {card.label}
                    </Typography>
                    <Typography variant="h5" fontWeight={700}>
                      {card.value ?? 0}
                    </Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}
