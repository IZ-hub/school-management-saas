import { useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { ArrowForward as ArrowIcon, UndoOutlined as UndoIcon } from '@mui/icons-material'
import { api } from '../lib/api'
import { toDate } from '../lib/attendanceApi'
import { brand } from '../theme'

interface PlanStudent { id: string; firstName: string; lastName: string; admissionNumber: string }
interface PlanClass { classId: string; name: string; suggested: string; students: PlanStudent[] }
interface Plan {
  toSession: string
  classes: PlanClass[]
  last: { id: string; toSession: string; at: unknown; byName: string; counts: { promoted: number; graduated: number; stayed: number } } | null
}

const errorText = (err: any, fallback: string) => {
  const msg = err?.response?.data?.message
  return Array.isArray(msg) ? msg[0] : msg || fallback
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

export default function Promotion() {
  const [plan, setPlan] = useState<Plan | null>(null)
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [holdBack, setHoldBack] = useState<Set<string>>(new Set())
  const [toSession, setToSession] = useState('')
  const [picking, setPicking] = useState<PlanClass | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState('')

  const load = () =>
    api.get('/promotion/plan').then((r) => {
      const p: Plan = r.data.data
      setPlan(p)
      setToSession(p.toSession)
      setTargets(Object.fromEntries(p.classes.map((c) => [c.classId, c.suggested])))
      setHoldBack(new Set())
    }).catch((err) => setError(errorText(err, 'Failed to load classes')))
  useEffect(() => { load() }, [])

  const summary = useMemo(() => {
    const s = { promoted: 0, graduated: 0, stayed: 0 }
    for (const c of plan?.classes ?? []) {
      for (const st of c.students) {
        const to = targets[c.classId]
        if (holdBack.has(st.id) || to === 'STAY' || to === c.classId) s.stayed++
        else if (to === 'GRADUATE') s.graduated++
        else s.promoted++
      }
    }
    return s
  }, [plan, targets, holdBack])

  const y = Number(toSession.slice(0, 4)) || new Date().getFullYear()
  const sessions = [y - 1, y, y + 1].map((v) => `${v}/${v + 1}`)
  const className = (id: string) => plan?.classes.find((c) => c.classId === id)?.name ?? ''

  const apply = async () => {
    if (!plan) return
    setBusy(true)
    setError('')
    try {
      const res = (await api.post('/promotion/apply', {
        toSession,
        moves: plan.classes.map((c) => ({ fromClassId: c.classId, to: targets[c.classId] ?? 'STAY' })),
        holdBack: [...holdBack],
      })).data.data
      setConfirming(false)
      setTyped('')
      setDone(`Done. ${plural(res.counts.promoted, 'student')} moved up, ${res.counts.graduated} graduated and ${res.counts.stayed} stayed in their class.`)
      load()
    } catch (err) {
      setError(errorText(err, 'Failed to promote students'))
      setConfirming(false)
    } finally {
      setBusy(false)
    }
  }

  const undo = async () => {
    if (!plan?.last || !window.confirm(`Undo the promotion into ${plan.last.toSession}? Every student goes back to the class they were in, and graduates come back.`)) return
    try {
      const res = (await api.post(`/promotion/${plan.last.id}/undo`)).data.data
      setDone(`Undone. ${plural(res.restored, 'student')} moved back.`)
      load()
    } catch (err) {
      setError(errorText(err, 'Failed to undo'))
    }
  }

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 980, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Typography variant="h4">Promotion</Typography>
      <Typography sx={{ color: brand.muted, fontSize: '14.5px', mb: 3 }}>At the end of the session, move every class up in one go. The final year graduates.</Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {done && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setDone('')}>{done}</Alert>}

      {plan?.last && (
        <Paper sx={{ p: { xs: 2, sm: 2.25 }, mb: 2, display: 'flex', alignItems: { sm: 'center' }, flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 700 }}>Last promotion: into {plan.last.toSession}</Typography>
            <Typography sx={{ fontSize: '13px', color: brand.muted }}>
              {toDate(plan.last.at)?.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} by {plan.last.byName} · {plan.last.counts.promoted} moved up, {plan.last.counts.graduated} graduated, {plan.last.counts.stayed} stayed
            </Typography>
          </Box>
          <Button startIcon={<UndoIcon />} onClick={undo}>Undo</Button>
        </Paper>
      )}

      {!plan ? <Skeleton variant="rounded" height={300} /> : plan.classes.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}><Typography sx={{ color: brand.muted }}>Create your classes first, on the Classes page.</Typography></Paper>
      ) : (
        <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
            <Typography sx={{ fontSize: '14px', color: brand.muted }}>We've suggested where each class goes. Change any that are different at your school.</Typography>
            <TextField select size="small" label="Moving into" value={toSession} onChange={(e) => setToSession(e.target.value)} sx={{ width: 160, flexShrink: 0 }}>
              {sessions.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
          </Stack>

          <Box sx={{ border: `1px solid ${brand.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            {plan.classes.map((c, i) => {
              const held = c.students.filter((s) => holdBack.has(s.id)).length
              const to = targets[c.classId] ?? 'STAY'
              return (
                <Stack key={c.classId} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} spacing={{ xs: 1, sm: 2 }} sx={{ px: { xs: 1.5, sm: 2 }, py: 1.25, borderTop: i ? `1px solid ${brand.border}` : 'none' }}>
                  <Box sx={{ width: { sm: 150 }, flexShrink: 0 }}>
                    <Typography sx={{ fontSize: '14.5px', fontWeight: 700 }}>{c.name}</Typography>
                    <Typography sx={{ fontSize: '12px', color: brand.subtle }}>{plural(c.students.length, 'student')}</Typography>
                  </Box>
                  <ArrowIcon sx={{ display: { xs: 'none', sm: 'block' }, color: brand.subtle, fontSize: 18 }} />
                  <TextField select size="small" value={to} onChange={(e) => setTargets((t) => ({ ...t, [c.classId]: e.target.value }))} sx={{ width: { xs: '100%', sm: 230 } }}
                    inputProps={{ 'aria-label': `Where ${c.name} goes` }}>
                    {plan.classes.filter((x) => x.classId !== c.classId).map((x) => <MenuItem key={x.classId} value={x.classId}>{x.name}</MenuItem>)}
                    <MenuItem value="GRADUATE">Graduate (leaves the school)</MenuItem>
                    <MenuItem value="STAY">Stay in {c.name}</MenuItem>
                  </TextField>
                  <Box sx={{ flex: 1 }} />
                  {c.students.length > 0 && to !== 'STAY' && (
                    <ButtonBase onClick={() => setPicking(c)} sx={{ fontSize: '13px', fontWeight: 600, color: held ? '#7a4c00' : brand.green, px: 1, py: 0.5, borderRadius: '8px', alignSelf: { xs: 'flex-start', sm: 'auto' } }}>
                      {held ? `${plural(held, 'student')} repeating` : 'Choose who repeats'}
                    </ButtonBase>
                  )}
                </Stack>
              )
            })}
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} sx={{ mt: 2 }}>
            <Typography sx={{ fontSize: '14px' }}>
              <b>{summary.promoted}</b> move up · <b>{summary.graduated}</b> graduate · <b>{summary.stayed}</b> stay
            </Typography>
            <Button variant="contained" disabled={summary.promoted + summary.graduated === 0} onClick={() => setConfirming(true)}>Promote students</Button>
          </Stack>
        </Paper>
      )}

      {picking && (
        <Dialog open onClose={() => setPicking(null)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>Who repeats {picking.name}?</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: '13px', color: brand.muted, mb: 1 }}>Ticked students stay in {picking.name}. Everyone else goes to {targets[picking.classId] === 'GRADUATE' ? 'graduation' : className(targets[picking.classId])}.</Typography>
            <Stack>
              {picking.students.map((s) => (
                <FormControlLabel key={s.id} control={<Checkbox size="small" checked={holdBack.has(s.id)} onChange={() => setHoldBack((h) => { const n = new Set(h); n.has(s.id) ? n.delete(s.id) : n.add(s.id); return n })} />}
                  label={<Typography sx={{ fontSize: '14px' }}>{s.firstName} {s.lastName} <Box component="span" sx={{ color: brand.subtle, fontSize: '12px' }}>{s.admissionNumber}</Box></Typography>} />
              ))}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}><Button variant="contained" onClick={() => setPicking(null)}>Done</Button></DialogActions>
        </Dialog>
      )}

      {confirming && (
        <Dialog open onClose={() => setConfirming(false)} maxWidth="xs" fullWidth>
          <DialogTitle sx={{ fontWeight: 700 }}>Promote students into {toSession}?</DialogTitle>
          <DialogContent>
            <Typography sx={{ fontSize: '14px', mb: 1.5 }}>
              {plural(summary.promoted, 'student')} move up, {summary.graduated} graduate and leave the school, and {summary.stayed} stay. You can undo this afterwards.
            </Typography>
            <TextField label='Type "PROMOTE" to confirm' value={typed} onChange={(e) => setTyped(e.target.value)} fullWidth autoFocus />
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setConfirming(false)}>Cancel</Button>
            <Button variant="contained" disabled={typed.trim().toUpperCase() !== 'PROMOTE' || busy} onClick={apply}>{busy ? 'Promoting…' : 'Promote'}</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  )
}
