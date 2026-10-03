import { ChangeEvent, useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Grid, MenuItem, Paper, Skeleton, Snackbar, Stack, TextField, Typography } from '@mui/material'
import { UploadOutlined as UploadIcon, ContentCopyOutlined as CopyIcon, CheckCircleRounded as OkIcon } from '@mui/icons-material'
import { TERMS, TERM_LABEL, Term } from '../lib/examsApi'
import { PaystackSettings, SchoolSettings, getPaystack, getSchool, removePaystackKey, resizeImage, saveTermDates, savePaystackKey, updateSchool } from '../lib/schoolApi'
import { brand } from '../theme'

const FIELDS: { key: 'name' | 'motto' | 'principalName' | 'address' | 'city' | 'state' | 'phone' | 'email'; label: string; max: number; half?: boolean; hint?: string }[] = [
  { key: 'name', label: 'School name', max: 100 },
  { key: 'motto', label: 'Motto', max: 120, hint: 'Printed under the name on report cards and receipts' },
  { key: 'principalName', label: "Principal's name", max: 80, hint: 'e.g. Mrs. A. Okon — printed beside the principal’s signature' },
  { key: 'address', label: 'Address', max: 200 },
  { key: 'city', label: 'City', max: 60, half: true },
  { key: 'state', label: 'State', max: 60, half: true },
  { key: 'phone', label: 'Phone', max: 30, half: true },
  { key: 'email', label: 'Email', max: 120, half: true },
]

const errorText = (err: any, fallback: string) => {
  const msg = err?.response?.data?.message
  return Array.isArray(msg) ? msg[0] : msg || fallback
}

type TermForm = Record<Term, { start: string; end: string }>
const emptyTerms = (): TermForm => ({ FIRST: { start: '', end: '' }, SECOND: { start: '', end: '' }, THIRD: { start: '', end: '' } })

export default function Settings() {
  const [school, setSchool] = useState<SchoolSettings | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [logo, setLogo] = useState<string | null>(null)
  const [session, setSession] = useState('')
  const [terms, setTerms] = useState<TermForm>(emptyTerms())
  const [saving, setSaving] = useState<'details' | 'terms' | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const fill = (s: SchoolSettings) => {
    setSchool(s)
    setForm(Object.fromEntries(FIELDS.map((f) => [f.key, s[f.key] ?? ''])))
    setLogo(s.logo)
  }

  useEffect(() => {
    getSchool(true).then((s) => { fill(s); setSession(s.currentTerm.session) }).catch((err) => setError(errorText(err, 'Failed to load settings')))
  }, [])

  // Show the saved dates for the chosen session.
  useEffect(() => {
    if (!school || !session) return
    const t = emptyTerms()
    school.termDates.filter((d) => d.session === session).forEach((d) => (t[d.term] = { start: d.start, end: d.end }))
    setTerms(t)
  }, [school, session])

  const detailsDirty = !!school && (FIELDS.some((f) => (form[f.key] ?? '') !== (school[f.key] ?? '')) || logo !== school.logo)

  const pickLogo = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try { setLogo(await resizeImage(file)) } catch (err: any) { setError(err.message) }
  }

  const saveDetails = async () => {
    setSaving('details')
    setError('')
    try {
      fill(await updateSchool({ ...form, logo }))
      setNotice('School details saved')
    } catch (err) {
      setError(errorText(err, 'Failed to save'))
    } finally {
      setSaving(null)
    }
  }

  const filled = TERMS.filter((t) => terms[t].start || terms[t].end)
  const termsValid = filled.every((t) => terms[t].start && terms[t].end)
  const saveTerms = async () => {
    setSaving('terms')
    setError('')
    try {
      fill(await saveTermDates(session, filled.map((t) => ({ term: t, ...terms[t] }))))
      setNotice(`Term dates saved for ${session}`)
    } catch (err) {
      setError(errorText(err, 'Failed to save term dates'))
    } finally {
      setSaving(null)
    }
  }

  const y = Number((school?.currentTerm.session ?? '2026/2027').slice(0, 4))
  const sessions = [y - 1, y, y + 1].map((v) => `${v}/${v + 1}`)

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 880, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Typography variant="h4">School settings</Typography>
      <Typography sx={{ color: brand.muted, fontSize: '14.5px', mb: 3 }}>Your details and logo appear on report cards, receipts and statements.</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {!school ? <Skeleton variant="rounded" height={400} /> : (
        <Stack spacing={2}>
          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Typography component="h2" sx={{ fontSize: '15px', fontWeight: 700, mb: 2 }}>School details</Typography>
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 2.5 }}>
              <Box sx={{ width: 76, height: 76, borderRadius: '12px', border: `1px dashed ${brand.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#fbfaf6', overflow: 'hidden', flexShrink: 0 }}>
                {logo ? <Box component="img" src={logo} alt="School logo" sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <Typography sx={{ fontSize: '12px', color: brand.subtle }}>No logo</Typography>}
              </Box>
              <Box>
                <Stack direction="row" spacing={1}>
                  <Button size="small" variant="outlined" startIcon={<UploadIcon />} onClick={() => fileRef.current?.click()}>{logo ? 'Change logo' : 'Upload logo'}</Button>
                  {logo && <Button size="small" color="error" onClick={() => setLogo(null)}>Remove</Button>}
                </Stack>
                <Typography sx={{ fontSize: '12px', color: brand.subtle, mt: 0.5 }}>PNG or JPG. It's resized automatically.</Typography>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={pickLogo} />
              </Box>
            </Stack>
            <Grid container spacing={2}>
              {FIELDS.map((f) => (
                <Grid item xs={12} sm={f.half ? 6 : 12} key={f.key}>
                  <TextField label={f.label} value={form[f.key] ?? ''} onChange={(e) => setForm((x) => ({ ...x, [f.key]: e.target.value }))} inputProps={{ maxLength: f.max }}
                    helperText={f.hint} fullWidth required={f.key === 'name'} error={f.key === 'name' && !form.name?.trim()} />
                </Grid>
              ))}
            </Grid>
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button variant="contained" onClick={saveDetails} disabled={!detailsDirty || !form.name?.trim() || saving === 'details'}>{saving === 'details' ? 'Saving…' : 'Save details'}</Button>
            </Stack>
          </Paper>

          <PaystackSection onNotice={setNotice} onError={setError} />

          <Paper sx={{ p: { xs: 2, sm: 3 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} sx={{ mb: 1 }}>
              <Typography component="h2" sx={{ fontSize: '15px', fontWeight: 700 }}>Term dates</Typography>
              <TextField select size="small" label="Session" value={session} onChange={(e) => setSession(e.target.value)} sx={{ width: 150 }}>
                {sessions.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
              </TextField>
            </Stack>
            <Typography sx={{ fontSize: '13px', color: brand.muted, mb: 2 }}>
              Used to pick the current term for fees and to count attendance on report cards. Without dates, we use September–December, January–April and May–August.
              {' '}Right now it's <b>{TERM_LABEL[school.currentTerm.term]} {school.currentTerm.session}</b>.
            </Typography>
            <Stack spacing={1.5}>
              {TERMS.map((t) => (
                <Stack key={t} direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
                  <Typography sx={{ width: { sm: 120 }, fontSize: '14px', fontWeight: 600 }}>{TERM_LABEL[t]}</Typography>
                  <TextField type="date" size="small" label="Starts" value={terms[t].start} onChange={(e) => setTerms((x) => ({ ...x, [t]: { ...x[t], start: e.target.value } }))} InputLabelProps={{ shrink: true }} sx={{ flex: 1 }} />
                  <TextField type="date" size="small" label="Ends" value={terms[t].end} onChange={(e) => setTerms((x) => ({ ...x, [t]: { ...x[t], end: e.target.value } }))} InputLabelProps={{ shrink: true }} inputProps={{ min: terms[t].start || undefined }} sx={{ flex: 1 }} />
                </Stack>
              ))}
            </Stack>
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
              <Button variant="contained" onClick={saveTerms} disabled={!termsValid || saving === 'terms'}>{saving === 'terms' ? 'Saving…' : 'Save term dates'}</Button>
            </Stack>
          </Paper>
        </Stack>
      )}

      <Snackbar open={!!notice} autoHideDuration={3000} onClose={() => setNotice('')} message={notice} />
    </Box>
  )
}

/** Connects the school's own Paystack account so parents can pay fees online. */
function PaystackSection({ onNotice, onError }: { onNotice: (m: string) => void; onError: (m: string) => void }) {
  const [settings, setSettings] = useState<PaystackSettings | null>(null)
  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  useEffect(() => { getPaystack().then(setSettings).catch(() => {}) }, [])

  const save = async () => {
    setBusy(true)
    try {
      setSettings(await savePaystackKey(key.trim()))
      setKey('')
      onNotice('Paystack connected. Parents can now pay online.')
    } catch (err) {
      onError(errorText(err, 'Failed to save the key'))
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    if (!window.confirm('Turn off online payments? Parents will no longer see "Pay online".')) return
    try { setSettings(await removePaystackKey()); onNotice('Online payments turned off') } catch (err) { onError(errorText(err, 'Failed')) }
  }

  if (!settings) return null
  const validShape = /^sk_(live|test)_[A-Za-z0-9]{20,}$/.test(key.trim())
  return (
    <Paper sx={{ p: { xs: 2, sm: 3 } }}>
      <Typography component="h2" sx={{ fontSize: '15px', fontWeight: 700, mb: 0.5 }}>Online payments (Paystack)</Typography>
      <Typography sx={{ fontSize: '13px', color: brand.muted, mb: 2 }}>
        Parents pay fees from their page by card, bank transfer or USSD. The money goes straight into your school's own Paystack account, and each payment is recorded with a receipt automatically.
      </Typography>
      {settings.enabled ? (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
            <OkIcon sx={{ color: '#1f6f43', fontSize: 20 }} />
            <Typography sx={{ fontSize: '14px' }}>
              Connected · {settings.mode === 'live' ? 'Live' : 'Test mode (no real money)'} · key ending {settings.keyHint}
            </Typography>
          </Stack>
          <Button color="error" onClick={remove}>Turn off</Button>
        </Stack>
      ) : settings.needsNewKey ? (
        <Alert severity="warning" sx={{ mb: 2 }}>Your saved Paystack key can no longer be read. Paste it again below.</Alert>
      ) : null}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'flex-start' }}>
        <TextField size="small" type="password" label={settings.enabled ? 'Replace secret key' : 'Paystack secret key'} value={key} onChange={(e) => setKey(e.target.value)} autoComplete="off"
          placeholder="sk_live_…" helperText="Paystack → Settings → API Keys & Webhooks. It's stored encrypted and never shown again." sx={{ flex: 1 }}
          error={!!key && !validShape} />
        <Button variant="contained" onClick={save} disabled={!validShape || busy} sx={{ mt: { sm: '1px' } }}>{busy ? 'Checking…' : 'Connect'}</Button>
      </Stack>

      {settings.enabled && (
        <Box sx={{ mt: 2, p: 1.5, borderRadius: '10px', bgcolor: '#fbfaf6', border: `1px solid ${brand.border}` }}>
          <Typography sx={{ fontSize: '13px', fontWeight: 600, mb: 0.5 }}>One more step: set your webhook URL in Paystack</Typography>
          <Typography sx={{ fontSize: '12.5px', color: brand.muted, mb: 1 }}>
            In Paystack → Settings → API Keys & Webhooks, paste this as the Webhook URL. It records payments even if a parent closes the page before returning.
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ flex: 1, fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '12.5px', wordBreak: 'break-all' }}>{settings.webhookUrl}</Box>
            <Button size="small" startIcon={<CopyIcon />} onClick={() => navigator.clipboard?.writeText(settings.webhookUrl).then(() => setCopied(true)).catch(() => {})}>{copied ? 'Copied' : 'Copy'}</Button>
          </Stack>
        </Box>
      )}
    </Paper>
  )
}
