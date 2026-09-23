import { useState } from 'react'
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  Avatar,
  Stack,
  Fade,
  Link as MuiLink,
} from '@mui/material'
import {
  School as SchoolIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Badge as BadgeIcon,
  Visibility,
  VisibilityOff,
  Login as LoginIcon,
} from '@mui/icons-material'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [schoolId, setSchoolId] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const setAccessToken = useAuthStore((state) => state.setAccessToken)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/auth/login', { email, password, schoolId })
      const { user, accessToken } = response.data.data

      setUser(user)
      setAccessToken(accessToken)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        bgcolor: '#f5f5f0',
        justifyContent: 'center',
        py: { xs: 3, md: 6 },
        px: { xs: 2, sm: 4 },
      }}
    >
      <Fade in timeout={500}>
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 520,
            p: { xs: 3, sm: 5 },
            borderRadius: 3,
            border: '1px solid #e0e0e0',
            bgcolor: '#fff',
            height: 'fit-content',
          }}
        >
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 4 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: '#1b5e20', width: 40, height: 40 }}>
                <SchoolIcon sx={{ fontSize: 22, color: '#fff' }} />
              </Avatar>
              <Typography variant="h6" fontWeight={700} color="#1b5e20">Schoolful LMS</Typography>
            </Stack>
          </Stack>

          <Typography variant="h4" component="h1" fontWeight={700} sx={{ mb: 0.75 }}>
            Sign in to your school
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Enter your credentials to access your dashboard
          </Typography>

          <Fade in={!!error}>
            <Box sx={{ mb: error ? 2 : 0 }}>
              {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
            </Box>
          </Fade>

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              fullWidth
              label="School ID"
              placeholder="e.g. GFA-2026-001"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              margin="normal"
              required
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fafafa' } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <BadgeIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Email"
              type="email"
              placeholder="e.g. adesua.okafor@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              margin="normal"
              required
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fafafa' } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              margin="normal"
              required
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fafafa' } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon fontSize="small" color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="toggle password visibility"
                      onClick={() => setShowPassword((show) => !show)}
                      edge="end"
                      size="small"
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              endIcon={<LoginIcon />}
              disabled={loading}
              sx={{
                mt: 4,
                mb: 1,
                py: 1.5,
                borderRadius: 2.5,
                bgcolor: '#1b5e20',
                textTransform: 'none',
                fontWeight: 600,
                fontSize: '1rem',
                '&:hover': { bgcolor: '#2e7d32' },
              }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 3 }}>
            Don't have a school yet?{' '}
            <MuiLink component={Link} to="/register" underline="hover" sx={{ color: '#1b5e20', fontWeight: 600 }}>
              Register your school
            </MuiLink>
          </Typography>
        </Paper>
      </Fade>
    </Box>
  )
}
