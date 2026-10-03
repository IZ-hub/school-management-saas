import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Button, CircularProgress, Paper, Stack, TextField, Typography } from '@mui/material'
import { acceptInvite, getInvite } from '../lib/parentApi'
import { useAuthStore } from '../store/authStore'
import { brand } from '../theme'

/** Where a parent lands from the school's setup link: choose a password, then go to their child's page. */
export default function ParentSetup() {
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const setAccessToken = useAuthStore((s) => s.setAccessToken)
  const code = window.location.hash.slice(1)
  const [invite, setInvite] = useState<{ email: string; firstName: string; schoolName: string; children: string[] } | null>(null)
  const [loadError, setLoadError] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!code) { setLoadError('This link is incomplete. Open the full link your school sent you.'); return }
    getInvite(code).then(setInvite).catch((err) => setLoadError(err.response?.data?.message || 'This link is not valid.'))
  }, [code])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 8) return setError('Use at least 8 characters.')
    if (password !== confirm) return setError("The passwords don't match.")
    setSaving(true)
    setError('')
    try {
      const data = await acceptInvite(code, password)
      setAccessToken(data.accessToken)
      setUser(data.user)
      history.replaceState(null, '', '/parent-setup')
      navigate('/parent', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Something went wrong. Try again.')
      setSaving(false)
    }
  }

  const names = invite?.children ?? []
  const childText = names.length <= 1 ? names[0] ?? 'your child' : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: brand.page, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, py: 4 }}>
      <Paper sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 4 } }}>
        <Typography sx={{ fontSize: '13px', fontWeight: 700, color: brand.green, letterSpacing: '0.04em', mb: 1 }}>SCHOOLFUL LMS</Typography>
        {!invite && !loadError && <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={26} /></Box>}
        {loadError && (
          <>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>Link not valid</Typography>
            <Alert severity="warning" sx={{ mb: 2 }}>{loadError}</Alert>
            <Button href="/login">Go to sign in</Button>
          </>
        )}
        {invite && (
          <form onSubmit={submit}>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>Welcome, {invite.firstName}</Typography>
            <Typography sx={{ color: brand.muted, fontSize: '14.5px', mt: 0.5, mb: 2.5 }}>
              {invite.schoolName} has given you access to {childText}'s attendance, fees and report cards. Choose a password to finish.
            </Typography>
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField label="Email" value={invite.email} disabled helperText="You'll sign in with this email" />
              <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" helperText="At least 8 characters" autoFocus />
              <TextField label="Confirm password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              <Button type="submit" variant="contained" size="large" disabled={saving}>{saving ? 'Setting up…' : 'Finish setup'}</Button>
            </Stack>
          </form>
        )}
      </Paper>
    </Box>
  )
}
