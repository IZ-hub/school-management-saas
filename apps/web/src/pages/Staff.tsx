import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { PersonAddAlt1Outlined as InviteIcon, MoreVert as MoreIcon, ContentCopyOutlined as CopyIcon } from '@mui/icons-material'
import { api } from '../lib/api'
import { ROLE_LABEL } from '../lib/roles'
import { STAFF_ROLE_OPTIONS, StaffInvite, StaffMember, StaffRole, changeStaffRole, inviteStaff, linkTeacherRecord, listStaff, resendStaffInvite, staffResetLink, setStaffEnabled, staffSetupLink } from '../lib/staffApi'
import { getSchool } from '../lib/schoolApi'
import { useAuthStore } from '../store/authStore'
import { brand } from '../theme'

interface TeacherRow { id: string; firstName: string; lastName: string; email?: string; status?: string }

const STATUS = {
  ACTIVE: { label: 'Active', bg: '#e3f1e6', fg: '#1d5f36' },
  INVITED: { label: 'Invited', bg: '#fdf0d5', fg: '#7a4c00' },
  DISABLED: { label: 'Switched off', bg: '#efeee8', fg: '#646b64' },
}

const errorText = (err: any, fallback: string) => {
  const msg = err?.response?.data?.message
  return Array.isArray(msg) ? msg[0] : msg || fallback
}

const ago = (ms: number | null) => {
  if (!ms) return 'Never signed in'
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  return days <= 0 ? 'Signed in today' : days === 1 ? 'Signed in yesterday' : `Signed in ${days} days ago`
}

export default function Staff() {
  const me = useAuthStore((s) => s.user)
  const isOwner = ['SCHOOL_OWNER', 'SUPER_ADMIN'].includes(me?.role ?? '')
  const [staff, setStaff] = useState<StaffMember[] | null>(null)
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [schoolName, setSchoolName] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [inviteOpen, setInviteOpen] = useState(false)
  const [link, setLink] = useState<(StaffInvite & { name: string; reset?: boolean }) | null>(null)
  const [menu, setMenu] = useState<{ el: HTMLElement; member: StaffMember } | null>(null)
  const [linking, setLinking] = useState<StaffMember | null>(null)

  const load = () => listStaff().then(setStaff).catch((err) => { setStaff([]); setError(errorText(err, 'Failed to load staff')) })
  useEffect(() => {
    load()
    api.get('/teachers').then((r) => setTeachers(r.data.data.filter((t: TeacherRow) => t.status !== 'INACTIVE'))).catch(() => {})
    getSchool().then((s) => setSchoolName(s.name)).catch(() => {})
  }, [])

  const canManage = (m: StaffMember) => m.userId !== me?.id && !['SCHOOL_OWNER', 'SUPER_ADMIN'].includes(m.role) && (isOwner || !['PRINCIPAL', 'VICE_PRINCIPAL'].includes(m.role))
  const grantable = STAFF_ROLE_OPTIONS.filter((r) => isOwner || !['PRINCIPAL', 'VICE_PRINCIPAL'].includes(r))

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setMenu(null)
    try { await fn(); setNotice(ok); load() } catch (err) { setError(errorText(err, 'Something went wrong')) }
  }

  const counts = useMemo(() => ({
    active: staff?.filter((s) => s.status === 'ACTIVE').length ?? 0,
    invited: staff?.filter((s) => s.status === 'INVITED').length ?? 0,
  }), [staff])

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1080, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-start' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4">Staff accounts</Typography>
          <Typography sx={{ color: brand.muted, fontSize: '14.5px' }}>Who can sign in, and what they can open. Teachers see academics; accountants see finance.</Typography>
        </Box>
        <Button variant="contained" startIcon={<InviteIcon />} onClick={() => setInviteOpen(true)} sx={{ flexShrink: 0 }}>Invite staff</Button>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {!staff ? <Skeleton variant="rounded" height={200} /> : (
        <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Typography sx={{ fontSize: '13px', color: brand.muted, mb: 1.5 }}>{counts.active} active{counts.invited ? ` · ${counts.invited} waiting to set up` : ''}</Typography>
          <Box sx={{ border: `1px solid ${brand.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            {staff.map((m, i) => (
              <Stack key={m.userId} direction="row" alignItems="center" spacing={2} sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, borderTop: i ? `1px solid ${brand.border}` : 'none', opacity: m.status === 'DISABLED' ? 0.6 : 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontSize: '14.5px', fontWeight: 600 }}>
                    {m.firstName} {m.lastName}{m.userId === me?.id && <Box component="span" sx={{ color: brand.subtle, fontWeight: 400 }}> (you)</Box>}
                  </Typography>
                  <Typography noWrap sx={{ fontSize: '12.5px', color: brand.subtle }}>
                    {[m.email, m.teacherName ? `Teacher record: ${m.teacherName}` : null, m.role === 'TEACHER' && !m.teacherId ? 'Not linked to a teacher record' : null, m.status === 'ACTIVE' ? ago(m.lastLogin) : m.status === 'INVITED' ? (m.inviteExpiresAt ? 'Setup link sent' : 'Setup link expired') : null].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <Typography sx={{ display: { xs: 'none', sm: 'block' }, width: 120, fontSize: '13.5px', fontWeight: 600 }}>{ROLE_LABEL[m.role] ?? m.role}</Typography>
                <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 999, fontSize: '12px', fontWeight: 600, bgcolor: STATUS[m.status].bg, color: STATUS[m.status].fg, whiteSpace: 'nowrap' }}>{STATUS[m.status].label}</Box>
                <Box sx={{ width: 34 }}>
                  {canManage(m) && (
                    <IconButton size="small" aria-label={`Options for ${m.firstName} ${m.lastName}`} onClick={(e) => setMenu({ el: e.currentTarget, member: m })}><MoreIcon fontSize="small" /></IconButton>
                  )}
                </Box>
              </Stack>
            ))}
          </Box>
        </Paper>
      )}

      <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
        {menu && menu.member.status === 'INVITED' && (
          <MenuItem onClick={() => { const m = menu.member; setMenu(null); resendStaffInvite(m.userId).then((r) => setLink({ ...r, name: m.firstName })).catch((err) => setError(errorText(err, 'Failed'))) }}>New setup link</MenuItem>
        )}
        {menu && menu.member.status === 'ACTIVE' && (
          <MenuItem onClick={() => { const m = menu.member; setMenu(null); staffResetLink(m.userId).then((r) => setLink({ ...r, name: m.firstName, reset: true })).catch((err) => setError(errorText(err, 'Failed'))) }}>Reset password link</MenuItem>
        )}
        {menu && menu.member.role === 'TEACHER' && (
          <MenuItem onClick={() => { setLinking(menu.member); setMenu(null) }}>{menu.member.teacherId ? 'Change teacher record' : 'Link to teacher record'}</MenuItem>
        )}
        {menu && grantable.filter((r) => r !== menu.member.role).map((r) => (
          <MenuItem key={r} onClick={() => act(() => changeStaffRole(menu.member.userId, r), `${menu.member.firstName} is now ${ROLE_LABEL[r].toLowerCase() === 'accountant' ? 'an' : 'a'} ${ROLE_LABEL[r].toLowerCase()}`)}>
            Make {ROLE_LABEL[r].toLowerCase()}
          </MenuItem>
        ))}
        {menu && (menu.member.status === 'DISABLED' ? (
          <MenuItem onClick={() => act(() => setStaffEnabled(menu.member.userId, true), `${menu.member.firstName} can sign in again`)}>Switch back on</MenuItem>
        ) : (
          <MenuItem sx={{ color: '#9b2a22' }} onClick={() => {
            if (window.confirm(`Switch off ${menu.member.firstName}'s account? They'll be signed out and won't be able to sign in.`)) act(() => setStaffEnabled(menu.member.userId, false), `${menu.member.firstName}'s account is switched off`)
            else setMenu(null)
          }}>Switch off account</MenuItem>
        ))}
      </Menu>

      {inviteOpen && (
        <InviteDialog
          teachers={teachers.filter((t) => !staff?.some((s) => s.teacherId === t.id))}
          roles={grantable}
          onClose={() => setInviteOpen(false)}
          onInvited={(r, name) => { setInviteOpen(false); setLink({ ...r, name }); load() }}
        />
      )}

      {link && <LinkDialog invite={link} schoolName={schoolName} onClose={() => setLink(null)} />}

      {linking && (
        <LinkTeacherDialog
          member={linking}
          teachers={teachers.filter((t) => t.id === linking.teacherId || !staff?.some((s) => s.teacherId === t.id))}
          onClose={() => setLinking(null)}
          onSave={(teacherId) => { const m = linking; setLinking(null); act(() => linkTeacherRecord(m.userId, teacherId), teacherId ? `${m.firstName} is linked. They now see the classes assigned to that teacher.` : `${m.firstName} is unlinked`) }}
        />
      )}

      <Snackbar open={!!notice} autoHideDuration={3000} onClose={() => setNotice('')} message={notice} />
    </Box>
  )
}

function InviteDialog({ teachers, roles, onClose, onInvited }: {
  teachers: TeacherRow[]
  roles: readonly StaffRole[]
  onClose: () => void
  onInvited: (r: StaffInvite, name: string) => void
}) {
  const [role, setRole] = useState<StaffRole>('TEACHER')
  const [teacher, setTeacher] = useState<TeacherRow | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const pickTeacher = (t: TeacherRow | null) => {
    setTeacher(t)
    if (t) { setFirstName(t.firstName); setLastName(t.lastName); setEmail(t.email ?? '') }
  }

  const valid = /^\S+@\S+\.\S+$/.test(email.trim()) && firstName.trim() && lastName.trim()
  const send = async () => {
    setBusy(true)
    setError('')
    try {
      onInvited(await inviteStaff({ email: email.trim(), firstName: firstName.trim(), lastName: lastName.trim(), role, ...(teacher && role === 'TEACHER' ? { teacherId: teacher.id } : {}) }), firstName.trim())
    } catch (err) {
      setError(errorText(err, 'Failed to invite'))
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Invite staff</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField select label="Role" value={role} onChange={(e) => setRole(e.target.value as StaffRole)}
            helperText={role === 'TEACHER' ? 'Classes, attendance, exams, results and report cards. No fees.' : role === 'ACCOUNTANT' ? 'Fees and payments. No results.' : 'Everything, including staff accounts and settings.'}>
            {roles.map((r) => <MenuItem key={r} value={r}>{ROLE_LABEL[r]}</MenuItem>)}
          </TextField>
          {role === 'TEACHER' && teachers.length > 0 && (
            <Autocomplete options={teachers} value={teacher} onChange={(_, t) => pickTeacher(t)} getOptionLabel={(t) => `${t.firstName} ${t.lastName}`}
              renderInput={(p) => <TextField {...p} label="From the Teachers page (optional)" helperText="Fills in their name and email" />} />
          )}
          <Stack direction="row" spacing={1.5}>
            <TextField label="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} inputProps={{ maxLength: 60 }} fullWidth />
            <TextField label="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} inputProps={{ maxLength: 60 }} fullWidth />
          </Stack>
          <TextField label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} inputProps={{ maxLength: 120 }} helperText="They'll sign in with this email" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={send} disabled={!valid || busy}>{busy ? 'Creating…' : 'Create setup link'}</Button>
      </DialogActions>
    </Dialog>
  )
}

function LinkDialog({ invite, schoolName, onClose }: { invite: StaffInvite & { name: string; reset?: boolean }; schoolName: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  const url = invite.reset ? `${window.location.origin}/reset#${invite.code}` : staffSetupLink(invite.code)
  const message = invite.reset
    ? `Hello ${invite.name}. Here is a link to choose a new SchoolBricks password (it works once and expires in 3 days): ${url}`
    : `Hello ${invite.name}. ${schoolName || 'Your school'} has invited you to SchoolBricks. Open this link to set your password (it works once and expires in 7 days): ${url}`
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Send this {invite.reset ? 'reset' : 'setup'} link to {invite.name}</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '13.5px', color: brand.muted, mb: 1.5 }}>
          It works once and expires in {invite.reset ? '3' : '7'} days. They choose {invite.reset ? 'a new' : 'a'} password, then sign in with {invite.email}.
        </Typography>
        <Box sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12.5px', bgcolor: '#fbfaf6', border: `1px solid ${brand.border}`, borderRadius: '8px', p: 1.25, wordBreak: 'break-all' }}>{url}</Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button startIcon={<CopyIcon />} onClick={() => navigator.clipboard?.writeText(message).then(() => setCopied(true)).catch(() => {})}>{copied ? 'Copied' : 'Copy message'}</Button>
        <Button variant="contained" onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  )
}

function LinkTeacherDialog({ member, teachers, onClose, onSave }: { member: StaffMember; teachers: TeacherRow[]; onClose: () => void; onSave: (teacherId: string | null) => void }) {
  const [teacher, setTeacher] = useState<TeacherRow | null>(teachers.find((t) => t.id === member.teacherId) ?? null)
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Link {member.firstName} to a teacher record</DialogTitle>
      <DialogContent>
        <Typography sx={{ fontSize: '13.5px', color: brand.muted, mb: 2 }}>
          A teacher can only work on the classes and subjects given to their record in Class subjects, and the classes they are form teacher of.
        </Typography>
        <Autocomplete options={teachers} value={teacher} onChange={(_, t) => setTeacher(t)} getOptionLabel={(t) => `${t.firstName} ${t.lastName}`}
          renderInput={(p) => <TextField {...p} label="Teacher record" />} />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        {member.teacherId && <Button color="error" onClick={() => onSave(null)} sx={{ mr: 'auto' }}>Unlink</Button>}
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" disabled={!teacher || teacher.id === member.teacherId} onClick={() => onSave(teacher!.id)}>Save</Button>
      </DialogActions>
    </Dialog>
  )
}
