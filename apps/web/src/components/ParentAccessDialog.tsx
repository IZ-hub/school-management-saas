import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { ContentCopyOutlined as CopyIcon, WhatsApp as WhatsAppIcon } from '@mui/icons-material'
import { InviteResult, LinkedParent, inviteParent, listParents, parentResetLink, resendInvite, resetLinkUrl, setupLink, unlinkParent } from '../lib/parentApi'
import { brand } from '../theme'
import { getSchool } from '../lib/schoolApi'

interface StudentLite { id: string; firstName: string; lastName: string; parentEmail?: string | null; parentPhone?: string | null }

const errorText = (err: any, fallback: string) => {
  const msg = err?.response?.data?.message
  return Array.isArray(msg) ? msg[0] : msg || fallback
}

/** Nigerian numbers like 0803 123 4567 become 2348031234567 for WhatsApp links. */
const waNumber = (phone?: string | null) => {
  const d = (phone ?? '').replace(/\D/g, '')
  if (!d) return ''
  return d.startsWith('0') ? `234${d.slice(1)}` : d
}

const STATUS = {
  ACTIVE: { label: 'Active', bg: '#e3f1e6', fg: '#1d5f36' },
  INVITED: { label: 'Invited', bg: '#fdf0d5', fg: '#7a4c00' },
  DISABLED: { label: 'Removed', bg: '#efeee8', fg: '#646b64' },
}

/** Give a parent access to a student's attendance, fees and report cards, with a one-time setup link to share. */
export default function ParentAccessDialog({ student, onClose }: { student: StudentLite; onClose: () => void }) {
  const [schoolName, setSchoolName] = useState('')
  useEffect(() => { getSchool().then((s) => setSchoolName(s.name)).catch(() => {}) }, [])
  const [parents, setParents] = useState<LinkedParent[] | null>(null)
  const [email, setEmail] = useState(student.parentEmail ?? '')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState(student.lastName)
  const [phone, setPhone] = useState(student.parentPhone ?? '')
  const [result, setResult] = useState<(InviteResult & { phone?: string; reset?: boolean }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const load = () => listParents(student.id).then(setParents).catch((err) => { setParents([]); setError(errorText(err, 'Failed to load parents')) })
  useEffect(() => { load() }, [student.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError('')
    try { await fn() } catch (err) { setError(errorText(err, 'Something went wrong')) } finally { setBusy(false) }
  }

  const send = () => run(async () => {
    const r = await inviteParent({ studentId: student.id, email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() || undefined })
    setResult({ ...r, phone })
    load()
  })

  const link = result?.status === 'INVITED' ? (result.reset ? resetLinkUrl(result.code) : setupLink(result.code)) : ''
  const message = result?.reset
    ? `Hello. Here is a link to choose a new Schoolful LMS password (it works once and expires in 3 days): ${link}`
    : `Hello. ${schoolName || 'Our school'} has given you access to ${student.firstName}'s attendance, fees and report cards on Schoolful LMS. Open this link to set your password (it works once and expires in 7 days): ${link}`
  const copy = () => navigator.clipboard?.writeText(link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }).catch(() => {})
  const valid = /^\S+@\S+\.\S+$/.test(email.trim()) && firstName.trim() && lastName.trim()

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Parent access · {student.firstName} {student.lastName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {!parents ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={22} /></Box> : parents.length > 0 && (
            <Box sx={{ border: `1px solid ${brand.border}`, borderRadius: '10px', overflow: 'hidden' }}>
              {parents.map((p, i) => (
                <Stack key={p.userId} direction="row" alignItems="center" spacing={1.5} sx={{ px: 1.5, py: 1.1, borderTop: i ? `1px solid ${brand.border}` : 'none' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontSize: '14px', fontWeight: 600 }}>{p.firstName} {p.lastName}</Typography>
                    <Typography noWrap sx={{ fontSize: '12px', color: brand.subtle }}>{p.email}{p.children > 1 ? ` · ${p.children} children` : ''}</Typography>
                  </Box>
                  <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 999, fontSize: '12px', fontWeight: 600, bgcolor: STATUS[p.status].bg, color: STATUS[p.status].fg }}>{STATUS[p.status].label}</Box>
                  {p.status === 'INVITED' && (
                    <Button size="small" disabled={busy} onClick={() => run(async () => { setResult({ ...(await resendInvite(p.userId)), phone: p.phone ?? '' }) })}>New link</Button>
                  )}
                  {p.status === 'ACTIVE' && (
                    <Button size="small" disabled={busy} onClick={() => run(async () => { const r = await parentResetLink(p.userId); setResult({ status: 'INVITED', userId: p.userId, email: r.email, code: r.code, expiresAt: '', phone: p.phone ?? '', reset: true }) })}>Reset link</Button>
                  )}
                  <Button size="small" color="error" disabled={busy} onClick={() => {
                    if (window.confirm(`Remove ${p.firstName}'s access to ${student.firstName}?`)) run(async () => { await unlinkParent(p.userId, student.id); setResult(null); await load() })
                  }}>Remove</Button>
                </Stack>
              ))}
            </Box>
          )}

          {result ? (
            result.status === 'LINKED' ? (
              <Alert severity="success">{result.email} already has an account, so {student.firstName} has been added to it. They'll see {student.firstName} next time they sign in.</Alert>
            ) : (
              <Box sx={{ border: `1px solid #9fcdab`, bgcolor: '#f3f9f4', borderRadius: '10px', p: 1.75 }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 700, mb: 0.5 }}>Send this {result.reset ? 'password reset' : 'setup'} link to the parent</Typography>
                <Typography sx={{ fontSize: '12.5px', color: brand.muted, mb: 1.25 }}>It works once and expires in {result.reset ? '3' : '7'} days. They choose {result.reset ? 'a new' : 'a'} password, then sign in with {result.email}.</Typography>
                <Box sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12.5px', bgcolor: brand.surface, border: `1px solid ${brand.border}`, borderRadius: '8px', p: 1, wordBreak: 'break-all', mb: 1.25 }}>{link}</Box>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" startIcon={<CopyIcon />} onClick={copy}>{copied ? 'Copied' : 'Copy link'}</Button>
                  <Button size="small" variant="contained" startIcon={<WhatsAppIcon />} target="_blank" rel="noopener"
                    href={`https://wa.me/${waNumber(result.phone)}?text=${encodeURIComponent(message)}`}>Send on WhatsApp</Button>
                </Stack>
              </Box>
            )
          ) : (
            <>
              <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>{parents?.length ? 'Add another parent' : 'Invite a parent'}</Typography>
              <Typography sx={{ fontSize: '12.5px', color: brand.muted, mt: '-8px !important' }}>
                They'll see only {student.firstName}'s attendance, fees and published report cards.
              </Typography>
              <Stack direction="row" spacing={1.5}>
                <TextField label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} inputProps={{ maxLength: 60 }} fullWidth autoFocus />
                <TextField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} inputProps={{ maxLength: 60 }} fullWidth />
              </Stack>
              <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} inputProps={{ maxLength: 120 }} helperText="They'll sign in with this email" />
              <TextField label="Phone (for WhatsApp, optional)" value={phone} onChange={(e) => setPhone(e.target.value)} inputProps={{ maxLength: 30 }} />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {result ? (
          <>
            <Button onClick={() => { setResult(null); setFirstName(''); setEmail('') }}>Add another</Button>
            <Button variant="contained" onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <Button onClick={onClose}>Close</Button>
            <Button variant="contained" onClick={send} disabled={!valid || busy}>{busy ? 'Creating…' : 'Create setup link'}</Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  )
}
