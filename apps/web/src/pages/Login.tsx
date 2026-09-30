import { useState } from 'react'
import { Alert, Box, Button, IconButton, InputAdornment, Link as MuiLink } from '@mui/material'
import { VisibilityOutlined as Visibility, VisibilityOffOutlined as VisibilityOff } from '@mui/icons-material'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'
import { AuthCard, AuthField, AuthShell, authColors, describeError, primaryButtonSx } from '../components/auth/AuthShell'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [schoolId, setSchoolId] = useState('')
  // Only shown when the server says this email exists at more than one school.
  const [needsSchoolId, setNeedsSchoolId] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string; schoolId?: string }>({})
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const setUser = useAuthStore((state) => state.setUser)
  const setAccessToken = useAuthStore((state) => state.setAccessToken)

  const validate = () => {
    const errs: typeof fieldErrors = {}
    if (!email.trim()) errs.email = 'Enter your email address'
    else if (!/^\S+@\S+\.\S+$/.test(email.trim())) errs.email = 'Enter a valid email address'
    if (!password) errs.password = 'Enter your password'
    if (needsSchoolId && !schoolId.trim()) errs.schoolId = 'Enter your School ID'
    setFieldErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validate()) return
    setLoading(true)

    try {
      const response = await api.post('/auth/login', {
        email: email.trim(),
        password,
        ...(needsSchoolId ? { schoolId: schoolId.trim() } : {}),
      })
      const { user, accessToken } = response.data.data
      setAccessToken(accessToken)
      // Marking the user signed in re-renders /login as <AfterSignIn />, which picks the destination.
      setUser(user)
    } catch (err: any) {
      if (err.response?.data?.code === 'SCHOOL_ID_REQUIRED') {
        setNeedsSchoolId(true)
      }
      setError(describeError(err, 'Invalid email or password'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell
      title="Log in to Schoolful LMS"
      subtitle="Log in to your Schoolful LMS school."
      topLinkPrompt="Need an account?"
      topLinkLabel="Start free trial"
      topLinkTo="/register"
    >
      {error && (
        <Alert severity="error" role="alert" sx={{ mb: '16px', borderRadius: '12px', border: '1px solid #f1c2bd' }}>
          {error}
        </Alert>
      )}

      <AuthCard>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <AuthField
            id="login-email"
            label="Email"
            type="email"
            autoComplete="email"
            inputMode="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <AuthField
            id="login-password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={fieldErrors.password}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((show) => !show)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          {needsSchoolId && (
            <AuthField
              id="login-school-id"
              label="School ID"
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              error={fieldErrors.schoolId}
              helperText="Your school administrator can give you this."
            />
          )}

          <Button type="submit" fullWidth variant="contained" disabled={loading} sx={primaryButtonSx}>
            {loading ? 'Logging in…' : 'Log in'}
          </Button>

          <Box sx={{ textAlign: 'center', mt: '16px', lineHeight: '20px' }}>
            <MuiLink
              href="mailto:support@schoolful.app?subject=Password%20reset%20request"
              underline="hover"
              sx={{ color: authColors.muted, fontSize: '14px' }}
            >
              Forgot password?
            </MuiLink>
          </Box>
        </Box>
      </AuthCard>
    </AuthShell>
  )
}
