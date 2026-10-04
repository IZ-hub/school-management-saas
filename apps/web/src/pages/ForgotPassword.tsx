import { FormEvent, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Alert, Box, Button, Link as MuiLink, Typography } from '@mui/material'
import { api } from '../lib/api'
import { AuthCard, AuthField, AuthShell, authColors, describeError, primaryButtonSx } from '../components/auth/AuthShell'

/** "Forgot password?": emails a one-hour reset link if the account exists. */
export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ emailEnabled: boolean } | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setFieldError('Enter a valid email address')
    setFieldError('')
    setLoading(true)
    try {
      setDone((await api.post('/auth/forgot-password', { email: email.trim() })).data.data)
    } catch (err) {
      setError(describeError(err, 'Something went wrong. Try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to choose a new one." topLinkPrompt="Remembered it?" topLinkLabel="Log in" topLinkTo="/login">
      {error && <Alert severity="error" role="alert" sx={{ mb: '16px', borderRadius: '12px' }}>{error}</Alert>}
      <AuthCard>
        {done ? (
          <Box>
            <Typography sx={{ fontSize: '16px', fontWeight: 700, mb: 1 }}>Check your email</Typography>
            <Typography sx={{ fontSize: '14.5px', color: authColors.muted, mb: 2 }}>
              If an account uses <b>{email.trim()}</b>, we've sent it a link to reset the password. The link works once and expires in 1 hour. Check your spam folder too.
            </Typography>
            {!done.emailEnabled && (
              <Alert severity="info" sx={{ mb: 2 }}>Email isn't switched on yet. Ask your school admin for a reset link from the Staff accounts or Students page.</Alert>
            )}
            <Typography sx={{ fontSize: '14px', color: authColors.muted }}>
              No email? Your school admin can also create a reset link for you.
            </Typography>
          </Box>
        ) : (
          <Box component="form" onSubmit={submit} noValidate>
            <AuthField id="forgot-email" label="Email" type="email" autoComplete="email" inputMode="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} error={fieldError} />
            <Button type="submit" fullWidth variant="contained" disabled={loading} sx={primaryButtonSx}>{loading ? 'Sending…' : 'Email me a reset link'}</Button>
          </Box>
        )}
        <Box sx={{ textAlign: 'center', mt: '16px' }}>
          <MuiLink component={RouterLink} to="/login" underline="hover" sx={{ color: authColors.muted, fontSize: '14px' }}>Back to log in</MuiLink>
        </Box>
      </AuthCard>
    </AuthShell>
  )
}
