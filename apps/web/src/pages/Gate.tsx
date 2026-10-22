import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material'
import {
  QrCodeScanner as ScanIcon,
  Login as InIcon,
  Logout as OutIcon,
  Replay as RepeatIcon,
  ErrorOutline as ErrorIcon,
  VideocamOff as CameraOffIcon,
  Cameraswitch as SwitchIcon,
} from '@mui/icons-material'
import QrScanner from 'qr-scanner'
import { brand } from '../theme'
import { useAuthStore } from '../store/authStore'
import { ADMIN_ROLES } from '../lib/roles'
import { GateToday, ScanMode, ScanResult, getGateSettings, getGateToday, saveGateSettings, scanCard } from '../lib/gateApi'

type Shown = { kind: 'result'; r: ScanResult } | { kind: 'error'; message: string } | null

const LOOK: Record<ScanResult['action'], { title: string; bg: string; fg: string; icon: JSX.Element }> = {
  IN: { title: 'Clocked in', bg: '#e3f4ec', fg: '#0b4a36', icon: <InIcon /> },
  OUT: { title: 'Clocked out', bg: '#e6eefa', fg: '#1a569e', icon: <OutIcon /> },
  ALREADY_IN: { title: 'Already clocked in', bg: '#fdf2d9', fg: '#7d5300', icon: <RepeatIcon /> },
  ALREADY_OUT: { title: 'Already clocked out', bg: '#fdf2d9', fg: '#7d5300', icon: <RepeatIcon /> },
}

/** A short beep: higher for a good scan, lower for a problem. Silent if the browser blocks sound. */
function beep(ok: boolean) {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = ok ? 880 : 300
    gain.gain.value = 0.15
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.12 : 0.35))
    osc.onended = () => ctx.close()
  } catch {
    /* no sound available */
  }
  navigator.vibrate?.(ok ? 80 : [60, 60, 60])
}

/** Clock students in and out at the gate by scanning their ID cards. */
export default function Gate() {
  const role = useAuthStore((s) => s.user?.role) ?? ''
  const isAdmin = ADMIN_ROLES.includes(role)
  const [mode, setMode] = useState<ScanMode>('AUTO')
  const [shown, setShown] = useState<Shown>(null)
  const [today, setToday] = useState<GateToday | null>(null)
  const [typed, setTyped] = useState('')
  const [cameraOn, setCameraOn] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [cameras, setCameras] = useState<QrScanner.Camera[]>([])
  const [cameraIndex, setCameraIndex] = useState(0)
  const [lateAfter, setLateAfter] = useState<string>('')
  const [lateSaved, setLateSaved] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const scannerRef = useRef<QrScanner | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const busy = useRef(false)
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const modeRef = useRef(mode)
  modeRef.current = mode

  const refresh = useCallback(() => { getGateToday().then(setToday).catch(() => {}) }, [])
  useEffect(() => {
    refresh()
    getGateSettings().then((s) => setLateAfter(s.lateAfter ?? '')).catch(() => {})
  }, [refresh])

  const handle = useCallback(async (raw: string) => {
    const code = raw.trim()
    if (!code || busy.current) return
    // The camera sees the same card many times a second: act on it once.
    const now = Date.now()
    if (code === last.current.code && now - last.current.at < 4000) return
    last.current = { code, at: now }
    busy.current = true
    try {
      const r = await scanCard(code, modeRef.current)
      setShown({ kind: 'result', r })
      beep(r.action === 'IN' || r.action === 'OUT')
      refresh()
    } catch (err: any) {
      setShown({ kind: 'error', message: err.response?.data?.message || "Couldn't record that scan. Check the internet connection and try again." })
      beep(false)
    } finally {
      busy.current = false
    }
  }, [refresh])

  // Camera scanning.
  useEffect(() => {
    if (!cameraOn || !videoRef.current) return
    const scanner = new QrScanner(videoRef.current, (res) => handle(res.data), {
      preferredCamera: cameras[cameraIndex]?.id ?? 'environment',
      highlightScanRegion: true,
      highlightCodeOutline: true,
      maxScansPerSecond: 8,
    })
    scannerRef.current = scanner
    scanner.start()
      .then(() => QrScanner.listCameras(true).then(setCameras).catch(() => {}))
      .catch(() => {
        setCameraError('The camera could not be opened. Allow camera access for this site, or use a handheld scanner in the box below.')
        setCameraOn(false)
      })
    return () => {
      scanner.stop()
      scanner.destroy()
      scannerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraOn, cameraIndex, handle])

  // A handheld scanner types the code and presses Enter into this box, so keep it ready.
  useEffect(() => {
    if (!cameraOn) inputRef.current?.focus()
  }, [cameraOn, shown])

  const submitTyped = (e: React.FormEvent) => {
    e.preventDefault()
    last.current = { code: '', at: 0 } // typing the same code again is deliberate
    handle(typed)
    setTyped('')
  }

  const saveLate = async () => {
    try {
      const s = await saveGateSettings(lateAfter || null)
      setLateSaved(s.lateAfter ? `Arrivals after ${s.lateAfter} are marked Late.` : 'Late arrivals are not marked.')
    } catch (err: any) {
      setLateSaved(err.response?.data?.message || "Couldn't save.")
    }
  }

  const modes: { id: ScanMode; label: string }[] = [
    { id: 'AUTO', label: 'Auto' },
    { id: 'IN', label: 'Arriving' },
    { id: 'OUT', label: 'Leaving' },
  ]

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1000, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Typography variant="h4">Gate</Typography>
      <Typography sx={{ color: brand.muted, fontSize: '14.5px', mb: 2.5 }}>
        Scan students' ID cards as they arrive and leave. Arrivals are ticked present in today's registers.
      </Typography>

      {/* Today's totals */}
      <Stack direction="row" spacing={1.5} sx={{ mb: 2.5 }}>
        {[
          { label: 'Clocked in today', value: today?.clockedIn ?? '–' },
          { label: 'Still in school', value: today?.stillIn ?? '–' },
          { label: 'Clocked out', value: today?.clockedOut ?? '–' },
        ].map((t) => (
          <Paper key={t.label} sx={{ flex: 1, p: { xs: 1.5, sm: 2 } }}>
            <Typography sx={{ fontSize: { xs: '24px', sm: '28px' }, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{t.value}</Typography>
            <Typography sx={{ fontSize: '12.5px', color: brand.muted }}>{t.label}</Typography>
          </Paper>
        ))}
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' }, gap: 2, alignItems: 'start' }}>
        <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
          {/* Mode */}
          <Box role="radiogroup" aria-label="Scan mode" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.5, p: 0.5, mb: 1, bgcolor: '#f4f3ee', borderRadius: '12px' }}>
            {modes.map((m) => (
              <Button key={m.id} role="radio" aria-checked={mode === m.id} onClick={() => setMode(m.id)}
                sx={{ height: 40, borderRadius: '9px', fontWeight: 700, bgcolor: mode === m.id ? brand.green : 'transparent', color: mode === m.id ? '#fff' : brand.text, '&:hover': { bgcolor: mode === m.id ? brand.green : '#e9e7df' } }}>
                {m.label}
              </Button>
            ))}
          </Box>
          <Typography sx={{ fontSize: '12.5px', color: brand.muted, mb: 2 }}>
            {mode === 'AUTO' ? 'Auto: the first scan of the day clocks in, the next one clocks out.' : mode === 'IN' ? 'Arriving: every scan clocks the student in.' : 'Leaving: every scan clocks the student out.'}
          </Typography>

          {/* Camera */}
          <Box sx={{ position: 'relative', borderRadius: '14px', overflow: 'hidden', bgcolor: '#0f2a24', aspectRatio: '4 / 3', mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box component="video" ref={videoRef} muted playsInline sx={{ width: '100%', height: '100%', objectFit: 'cover', display: cameraOn ? 'block' : 'none' }} />
            {!cameraOn && (
              <Stack alignItems="center" spacing={1.5} sx={{ color: '#fff', p: 2, textAlign: 'center' }}>
                <ScanIcon sx={{ fontSize: 48, color: brand.lemon }} />
                <Button variant="contained" onClick={() => { setCameraError(''); setCameraOn(true) }}
                  sx={{ bgcolor: brand.lemon, color: brand.green, fontWeight: 800, borderRadius: 999, px: 3, '&:hover': { bgcolor: brand.lemonHover } }}>
                  Start camera
                </Button>
                <Typography sx={{ fontSize: '12.5px', opacity: 0.8 }}>Point the camera at the QR code on the card.</Typography>
              </Stack>
            )}
          </Box>
          {cameraOn && (
            <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
              <Button size="small" startIcon={<CameraOffIcon />} onClick={() => setCameraOn(false)}>Stop camera</Button>
              {cameras.length > 1 && <Button size="small" startIcon={<SwitchIcon />} onClick={() => setCameraIndex((i) => (i + 1) % cameras.length)}>Switch camera</Button>}
            </Stack>
          )}
          {cameraError && <Alert severity="warning" sx={{ mb: 1.5 }}>{cameraError}</Alert>}

          {/* Handheld scanner or typing */}
          <Box component="form" onSubmit={submitTyped}>
            <TextField inputRef={inputRef} fullWidth size="small" label="Handheld scanner or card code" placeholder="e.g. SP1-ABCD234XYZ"
              value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off"
              helperText="A USB or Bluetooth scanner types into this box. You can also type the code printed under the QR." />
          </Box>
        </Paper>

        {/* On phones the column dissolves so the result sits above the camera, in view while scanning. */}
        <Box sx={{ display: { xs: 'contents', md: 'flex' }, flexDirection: 'column', gap: 2 }}>
          {/* Result */}
          <Paper aria-live="assertive" sx={{ p: 0, overflow: 'hidden', minHeight: 150, order: { xs: -1, md: 0 } }}>
            {!shown && (
              <Stack alignItems="center" justifyContent="center" sx={{ height: 150, color: brand.muted, px: 2, textAlign: 'center' }}>
                <ScanIcon sx={{ fontSize: 32, mb: 0.5 }} />
                <Typography sx={{ fontSize: '14px' }}>Scan a card to begin.</Typography>
              </Stack>
            )}
            {shown?.kind === 'error' && (
              <Stack direction="row" spacing={1.5} alignItems="flex-start" sx={{ p: 2.5, bgcolor: '#fbe4e2', color: '#9b2a22', minHeight: 150 }}>
                <ErrorIcon />
                <Box>
                  <Typography sx={{ fontWeight: 800, fontSize: '18px' }}>Not recorded</Typography>
                  <Typography sx={{ mt: 0.5 }}>{shown.message}</Typography>
                </Box>
              </Stack>
            )}
            {shown?.kind === 'result' && (() => {
              const r = shown.r
              const look = LOOK[r.action]
              return (
                <Box sx={{ p: 2.5, bgcolor: look.bg, color: look.fg, minHeight: 150 }}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {look.icon}
                    <Typography sx={{ fontWeight: 800, fontSize: '18px' }}>
                      {look.title} {r.action === 'ALREADY_IN' ? `at ${r.clockIn}` : r.action === 'ALREADY_OUT' ? `at ${r.clockOut}` : `· ${r.time}`}
                    </Typography>
                    {r.late && <Box component="span" sx={{ ml: 'auto', px: 1, py: 0.25, borderRadius: 999, bgcolor: '#7d5300', color: '#fff', fontSize: '12px', fontWeight: 700 }}>Late</Box>}
                  </Stack>
                  <Typography sx={{ fontWeight: 800, fontSize: { xs: '24px', sm: '28px' }, color: brand.text, mt: 1, lineHeight: 1.15 }}>{r.student.name}</Typography>
                  <Typography sx={{ color: brand.muted }}>{[r.student.className, r.student.admissionNumber].filter(Boolean).join(' · ')}</Typography>
                  <Typography sx={{ fontSize: '13px', color: brand.muted, mt: 1 }}>In {r.clockIn ?? '—'} · Out {r.clockOut ?? '—'}</Typography>
                </Box>
              )
            })()}
          </Paper>

          {/* Recent */}
          <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Typography sx={{ fontWeight: 700, mb: 1 }}>Today's scans</Typography>
            {!today || today.recent.length === 0 ? (
              <Typography sx={{ fontSize: '13.5px', color: brand.muted }}>No scans yet today.</Typography>
            ) : (
              <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
                {today.recent.map((e, i) => (
                  <Stack key={`${e.studentId}-${e.action}-${i}`} direction="row" alignItems="center" spacing={1.25} sx={{ py: 0.75, borderTop: i ? `1px solid ${brand.border}` : 'none' }}>
                    <Box component="span" sx={{ width: 40, fontSize: '12.5px', fontVariantNumeric: 'tabular-nums', color: brand.muted }}>{e.time}</Box>
                    <Box component="span" sx={{ px: 0.75, borderRadius: '6px', fontSize: '11.5px', fontWeight: 700, bgcolor: e.action === 'IN' ? '#e3f4ec' : '#e6eefa', color: e.action === 'IN' ? '#0b4a36' : '#1a569e' }}>{e.action === 'IN' ? 'In' : 'Out'}</Box>
                    <Typography noWrap sx={{ fontSize: '14px', flex: 1, minWidth: 0 }}>{e.name}</Typography>
                    <Typography noWrap sx={{ fontSize: '12.5px', color: brand.subtle }}>{e.className}</Typography>
                  </Stack>
                ))}
              </Box>
            )}
          </Paper>

          {isAdmin && (
            <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
              <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Late arrivals</Typography>
              <Typography sx={{ fontSize: '13px', color: brand.muted, mb: 1.5 }}>Students clocked in after this time are marked Late. Leave empty to mark everyone Present.</Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <TextField type="time" size="small" label="Late after" value={lateAfter} onChange={(e) => { setLateAfter(e.target.value); setLateSaved('') }} sx={{ width: 150 }} />
                <Button variant="outlined" onClick={saveLate}>Save</Button>
              </Stack>
              {lateSaved && <Typography sx={{ fontSize: '12.5px', color: brand.muted, mt: 1 }}>{lateSaved}</Typography>}
            </Paper>
          )}
        </Box>
      </Box>
    </Box>
  )
}
