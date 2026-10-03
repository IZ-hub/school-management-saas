import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { SendOutlined as SendIcon, SmsOutlined as SmsIcon, WebOutlined as PageIcon } from '@mui/icons-material'
import { api } from '../lib/api'
import { classLabels } from '../lib/classLabels'
import { toDate } from '../lib/attendanceApi'
import { AUDIENCE_LABEL, Audience, Preview, SentMessage, TEMPLATES, listMessages, messageProblems, previewMessage, sendMessage } from '../lib/messagesApi'
import { useAuthStore } from '../store/authStore'
import { brand } from '../theme'

interface ClassRow { id: string; name: string; status?: string; createdAt?: unknown }

const errorText = (err: any, fallback: string) => {
  const msg = err?.response?.data?.message
  return Array.isArray(msg) ? msg[0] : msg || fallback
}

export default function Messages() {
  const navigate = useNavigate()
  const isAccountant = useAuthStore((s) => s.user?.role) === 'ACCOUNTANT'
  const [params] = useSearchParams()
  const [classes, setClasses] = useState<ClassRow[]>([])
  const [audience, setAudience] = useState<Audience>((params.get('audience') as Audience) || (isAccountant ? 'OWING' : 'ALL'))
  const [classIds, setClassIds] = useState<string[]>(params.get('class') ? [params.get('class')!] : [])
  const [text, setText] = useState(params.get('audience') === 'ABSENT_TODAY' ? TEMPLATES[1].text : '')
  const [sms, setSms] = useState(false)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [history, setHistory] = useState<SentMessage[] | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [notice, setNotice] = useState('')
  const [problems, setProblems] = useState<{ msg: SentMessage; rows: Awaited<ReturnType<typeof messageProblems>> } | null>(null)
  const textRef = useRef<HTMLTextAreaElement>(null)

  const labels = useMemo(() => classLabels(classes), [classes])
  const active = useMemo(() => classes.filter((c) => c.status !== 'INACTIVE').sort((a, b) => (labels.get(a.id) ?? a.name).localeCompare(labels.get(b.id) ?? b.name, undefined, { numeric: true })), [classes, labels])

  const loadHistory = () => listMessages().then(setHistory).catch(() => setHistory([]))
  useEffect(() => {
    api.get('/classes').then((r) => setClasses(r.data.data)).catch(() => {})
    loadHistory()
  }, [])

  // Live preview: who gets it, how many SMS pages, and how it reads for the first family.
  useEffect(() => {
    if (!text.trim() || (audience === 'CLASSES' && classIds.length === 0)) { setPreview(null); return }
    const t = setTimeout(() => {
      previewMessage({ audience, classIds: classIds.length ? classIds : undefined, text, sms })
        .then((p) => { setPreview(p); setPreviewError(''); if (!p.smsAvailable) setSms(false) })
        .catch((err) => { setPreview(null); setPreviewError(errorText(err, 'Could not preview')) })
    }, 350)
    return () => clearTimeout(t)
  }, [audience, classIds, text, sms])

  const insert = (field: string) => {
    const el = textRef.current
    const at = el?.selectionStart ?? text.length
    setText((t) => t.slice(0, at) + field + t.slice(el?.selectionEnd ?? at))
    setTimeout(() => { el?.focus(); el?.setSelectionRange(at + field.length, at + field.length) }, 0)
  }

  const send = async () => {
    setSending(true)
    try {
      const res = await sendMessage({ audience, classIds: classIds.length ? classIds : undefined, text, sms })
      const s = res.counts.sms
      setNotice(`Sent to ${res.counts.students} ${res.counts.students === 1 ? 'family' : 'families'}${sms ? ` · ${s.sent} SMS delivered${s.failed ? `, ${s.failed} failed` : ''}${s.skipped ? `, ${s.skipped} without a phone` : ''}` : ''}`)
      setConfirming(false)
      setText('')
      loadHistory()
    } catch (err) {
      setPreviewError(errorText(err, 'Failed to send'))
      setConfirming(false)
    } finally {
      setSending(false)
    }
  }

  const audiences: Audience[] = isAccountant ? ['OWING'] : ['ALL', 'CLASSES', 'OWING', 'ABSENT_TODAY']
  const canSend = !!preview && preview.students > 0 && !preview.tooMany && text.trim().length > 0

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 980, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Typography variant="h4">Messages</Typography>
      <Typography sx={{ color: brand.muted, fontSize: '14.5px', mb: 3 }}>Send news, fee reminders and absence alerts. Every message appears on the parent's page; SMS is optional.</Typography>

      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField select label="Send to" value={audience} onChange={(e) => { setAudience(e.target.value as Audience); setClassIds([]) }} sx={{ minWidth: 280 }}>
              {audiences.map((a) => <MenuItem key={a} value={a}>{AUDIENCE_LABEL[a]}</MenuItem>)}
            </TextField>
            {(audience === 'CLASSES' || audience === 'ABSENT_TODAY' || audience === 'OWING') && (
              <TextField select label={audience === 'CLASSES' ? 'Classes' : 'Only these classes (optional)'} value={classIds} sx={{ flex: 1 }}
                SelectProps={{ multiple: true, renderValue: (v) => (v as string[]).map((id) => labels.get(id) ?? '').join(', ') }}
                onChange={(e) => setClassIds(typeof e.target.value === 'string' ? e.target.value.split(',') : (e.target.value as string[]))}>
                {active.map((c) => <MenuItem key={c.id} value={c.id}><Checkbox size="small" checked={classIds.includes(c.id)} />{labels.get(c.id) ?? c.name}</MenuItem>)}
              </TextField>
            )}
          </Stack>

          <Box>
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mb: 1 }}>
              <Typography sx={{ fontSize: '12.5px', color: brand.muted, mr: 0.5, alignSelf: 'center' }}>Start from:</Typography>
              {TEMPLATES.filter((t) => audiences.includes(t.audience)).map((t) => (
                <Chip key={t.label} label={t.label} size="small" variant="outlined" onClick={() => { setText(t.text); setAudience(t.audience) }} />
              ))}
            </Stack>
            <TextField inputRef={textRef} label="Message" value={text} onChange={(e) => setText(e.target.value)} multiline minRows={4} fullWidth inputProps={{ maxLength: 612 }}
              helperText={`${text.length}/612 characters${text ? ` · ${preview?.pages ?? 1} SMS ${preview?.pages === 1 ? 'page' : 'pages'} each` : ''}`} />
            <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap sx={{ mt: 0.5 }}>
              <Typography sx={{ fontSize: '12.5px', color: brand.muted, mr: 0.5, alignSelf: 'center' }}>Insert:</Typography>
              {['{parent}', '{student}', '{class}', ...(audience === 'OWING' ? ['{balance}'] : []), '{school}'].map((f) => (
                <ButtonBase key={f} onClick={() => insert(f)} sx={{ px: 0.9, py: 0.3, borderRadius: '6px', fontSize: '12.5px', fontFamily: 'ui-monospace, Menlo, monospace', bgcolor: '#f4f3ee', color: brand.text }}>{f}</ButtonBase>
              ))}
            </Stack>
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Stack direction="row" spacing={1} alignItems="center"><PageIcon sx={{ fontSize: 19, color: brand.green }} /><Typography sx={{ fontSize: '14px' }}>Parent page (always, free)</Typography></Stack>
            <FormControlLabel disabled={!preview?.smsAvailable} control={<Checkbox checked={sms} onChange={(e) => setSms(e.target.checked)} />}
              label={<Stack direction="row" spacing={0.75} alignItems="center"><SmsIcon sx={{ fontSize: 18 }} /><span>Also send by SMS</span></Stack>} />
            {preview && !preview.smsAvailable && !isAccountant && (
              <ButtonBase onClick={() => navigate('/settings')} sx={{ fontSize: '13px', color: brand.green, fontWeight: 600 }}>Set up SMS in School settings</ButtonBase>
            )}
          </Stack>

          {previewError && <Alert severity="error">{previewError}</Alert>}
          {preview && (
            <Box sx={{ border: `1px solid ${brand.border}`, borderRadius: '12px', p: 2, bgcolor: '#fbfaf6' }}>
              <Typography sx={{ fontSize: '13px', fontWeight: 700, mb: 0.75 }}>
                {preview.students === 0 ? 'Nobody matches this group.' : `${preview.students} ${preview.students === 1 ? 'family' : 'families'}`}
                {preview.students > 0 && (
                  <Box component="span" sx={{ fontWeight: 400, color: brand.muted }}>
                    {' '}· {preview.onParentPage} on their parent page{sms ? ` · ${preview.withPhone} by SMS (${preview.smsTotal} SMS pages)${preview.withoutPhone ? ` · ${preview.withoutPhone} without a phone` : ''}` : ''}
                  </Box>
                )}
              </Typography>
              {preview.students > 0 && (
                <Box sx={{ bgcolor: brand.surface, border: `1px solid ${brand.border}`, borderRadius: '10px', p: 1.5, fontSize: '14px', whiteSpace: 'pre-wrap' }}>{preview.sample}</Box>
              )}
              {preview.tooMany && <Typography sx={{ fontSize: '13px', color: '#9b2a22', mt: 1 }}>That's more than 2,000 families. Choose fewer classes.</Typography>}
            </Box>
          )}

          <Stack direction="row" justifyContent="flex-end">
            <Button variant="contained" startIcon={<SendIcon />} disabled={!canSend} onClick={() => setConfirming(true)}>Send message</Button>
          </Stack>
        </Stack>
      </Paper>

      <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography component="h2" sx={{ fontSize: '15px', fontWeight: 700, mb: 1.5 }}>Sent</Typography>
        {!history ? null : history.length === 0 ? (
          <Typography sx={{ fontSize: '14px', color: brand.muted }}>No messages sent yet.</Typography>
        ) : (
          <Box sx={{ border: `1px solid ${brand.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            {history.map((m, i) => (
              <Box key={m.id} sx={{ px: 2, py: 1.25, borderTop: i ? `1px solid ${brand.border}` : 'none' }}>
                <Typography sx={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
                <Typography sx={{ fontSize: '12.5px', color: brand.subtle, mt: 0.5 }}>
                  {toDate(m.createdAt)?.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })} · {m.byName} · {AUDIENCE_LABEL[m.audience]} · {m.counts.students} {m.counts.students === 1 ? 'family' : 'families'}
                  {m.sms && ` · ${m.counts.sms.sent} SMS sent`}
                  {m.sms && (m.counts.sms.failed + m.counts.sms.skipped > 0) && (
                    <ButtonBase onClick={() => messageProblems(m.id).then((rows) => setProblems({ msg: m, rows }))} sx={{ ml: 0.75, fontSize: 'inherit', color: '#9b2a22', fontWeight: 600, verticalAlign: 'baseline' }}>
                      {m.counts.sms.failed + m.counts.sms.skipped} not delivered
                    </ButtonBase>
                  )}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Paper>

      {confirming && preview && (
        <Dialog open onClose={() => setConfirming(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>Send to {preview.students} {preview.students === 1 ? 'family' : 'families'}?</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: '14px' }}>
              It will appear on {preview.onParentPage} parent {preview.onParentPage === 1 ? 'page' : 'pages'}{sms ? `, and ${preview.smsTotal} SMS ${preview.smsTotal === 1 ? 'page is' : 'pages are'} charged to your Termii account` : ''}. Messages can't be unsent.
            </Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
            <Button variant="contained" onClick={send} disabled={sending}>{sending ? 'Sending…' : 'Send'}</Button>
          </DialogActions>
        </Dialog>
      )}

      {problems && (
        <Dialog open onClose={() => setProblems(null)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>SMS not delivered</DialogTitle>
          <DialogContent>
            {problems.rows.map((p, i) => (
              <Stack key={i} direction="row" justifyContent="space-between" sx={{ py: 0.75, borderTop: i ? `1px solid ${brand.border}` : 'none' }}>
                <Typography sx={{ fontSize: '14px' }}>{p.studentName} <Box component="span" sx={{ color: brand.subtle }}>· {p.className}</Box></Typography>
                <Typography sx={{ fontSize: '13px', color: brand.muted }}>{p.status === 'NO_PHONE' ? 'No phone number' : `Failed: ${p.error ?? 'unknown'}`}</Typography>
              </Stack>
            ))}
            <Typography sx={{ fontSize: '12.5px', color: brand.subtle, mt: 1.5 }}>Add a parent phone on the Students page, or when giving parent access. The message is still on their parent page if they have one.</Typography>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}><Button onClick={() => setProblems(null)}>Close</Button></DialogActions>
        </Dialog>
      )}

      <Snackbar open={!!notice} autoHideDuration={5000} onClose={() => setNotice('')} message={notice} />
    </Box>
  )
}
