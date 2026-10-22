import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { ArrowBack as BackIcon, Print as PrintIcon } from '@mui/icons-material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { api } from '../lib/api'
import { brand } from '../theme'
import { CardSheet, IdCard, getCards } from '../lib/gateApi'

const GREEN = '#0e5c43'
const NIGHT = '#0f2a24'

/** One credit-card-size ID card (85.6 × 54 mm). */
function Card({ card, school, qr }: { card: IdCard; school: CardSheet['school']; qr: string | undefined }) {
  return (
    <Box className="id-card" sx={{
      width: '85.6mm', height: '54mm', boxSizing: 'border-box', borderRadius: '3mm', overflow: 'hidden', bgcolor: '#fff',
      border: '0.3mm solid #d9d6cc', display: 'flex', flexDirection: 'column', breakInside: 'avoid', fontFamily: brand.font,
    }}>
      <Box sx={{ bgcolor: NIGHT, color: '#fff', px: '3mm', py: '1.8mm', display: 'flex', alignItems: 'center', gap: '2mm' }}>
        {school.logo && <Box component="img" src={school.logo} alt="" sx={{ width: '7mm', height: '7mm', objectFit: 'contain', bgcolor: '#fff', borderRadius: '1mm' }} />}
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontSize: '3.2mm', fontWeight: 800, lineHeight: 1.15 }}>{school.name}</Typography>
          {school.motto && <Typography noWrap sx={{ fontSize: '2.2mm', opacity: 0.8, lineHeight: 1.2 }}>{school.motto}</Typography>}
        </Box>
        <Typography sx={{ ml: 'auto', fontSize: '2.2mm', fontWeight: 800, letterSpacing: '0.3mm', color: '#3fb68b', flexShrink: 0 }}>STUDENT ID</Typography>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', gap: '2.5mm', px: '3mm', py: '2.2mm', minHeight: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ fontSize: '4.2mm', fontWeight: 800, color: NIGHT, lineHeight: 1.1, wordBreak: 'break-word' }}>{card.firstName} {card.lastName}</Typography>
          <Box sx={{ mt: '1.5mm', display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '1.5mm', rowGap: '0.6mm', fontSize: '2.6mm' }}>
            <Box component="span" sx={{ color: '#5f6a63' }}>Class</Box>
            <Box component="span" sx={{ fontWeight: 700, color: NIGHT }}>{card.className || '—'}</Box>
            <Box component="span" sx={{ color: '#5f6a63' }}>Adm. no.</Box>
            <Box component="span" sx={{ fontWeight: 700, color: NIGHT, wordBreak: 'break-all' }}>{card.admissionNumber || '—'}</Box>
          </Box>
          <Typography sx={{ mt: 'auto', fontSize: '2.1mm', color: '#5f6a63', lineHeight: 1.3 }}>
            Scan at the gate on arrival and when leaving.{school.phone ? ` If found, call ${school.phone}.` : ''}
          </Typography>
        </Box>
        <Box sx={{ width: '25mm', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {qr ? <Box component="img" src={qr} alt={`QR code for ${card.firstName} ${card.lastName}`} sx={{ width: '25mm', height: '25mm' }} /> : <Box sx={{ width: '25mm', height: '25mm', bgcolor: '#f4f3ee' }} />}
          <Typography sx={{ fontSize: '2mm', fontFamily: 'ui-monospace, Menlo, monospace', color: '#3f4a44', mt: '0.5mm', letterSpacing: '0.1mm' }}>{card.qr}</Typography>
        </Box>
      </Box>
      <Box sx={{ height: '1.2mm', bgcolor: GREEN }} />
    </Box>
  )
}

/** Printable student ID cards with gate QR codes: a class, the whole school, or one student. */
export default function IdCards() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const classId = params.get('class') ?? ''
  const studentId = params.get('student') ?? ''
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [sheet, setSheet] = useState<CardSheet | null>(null)
  const [qrs, setQrs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get('/classes').then((r) => setClasses((r.data.data as any[]).filter((c) => c.status !== 'INACTIVE').map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })))).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    getCards(studentId ? undefined : classId || undefined)
      .then(async (s) => {
        const cards = studentId ? s.cards.filter((c) => c.studentId === studentId) : s.cards
        setSheet({ ...s, cards })
        const entries = await Promise.all(cards.map(async (c) => [c.studentId, await QRCode.toDataURL(c.qr, { margin: 1, width: 300, errorCorrectionLevel: 'M', color: { dark: NIGHT, light: '#ffffff' } })] as const))
        setQrs(Object.fromEntries(entries))
      })
      .catch((err) => setError(err.response?.data?.message || "Couldn't load the cards."))
      .finally(() => setLoading(false))
  }, [classId, studentId])

  const pages = useMemo(() => {
    const cards = sheet?.cards ?? []
    const out: IdCard[][] = []
    for (let i = 0; i < cards.length; i += 10) out.push(cards.slice(i, i + 10))
    return out
  }, [sheet])

  return (
    <Box sx={{ flexGrow: 1, px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4 } }}>
      <style>{`
        @page { size: A4; margin: 8mm; }
        @media print {
          body * { visibility: hidden; }
          .id-sheet, .id-sheet * { visibility: visible; }
          .id-sheet { position: absolute; left: 0; top: 0; }
          .id-page { break-after: page; box-shadow: none !important; margin: 0 !important; }
          .id-page:last-child { break-after: auto; }
        }
      `}</style>

      <Box className="no-print" sx={{ mb: 2.5 }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 1, ml: -1, color: brand.muted }}>Back</Button>
        <Typography variant="h4">Student ID cards</Typography>
        <Typography sx={{ color: brand.muted, fontSize: '14.5px', mb: 2 }}>
          Each card's QR code is scanned at the gate to clock the student in and out. Print on card stock, 10 per A4 page, then cut along the edges.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          {!studentId && (
            <TextField select size="small" label="Class" value={classId} onChange={(e) => { const n = new URLSearchParams(params); if (e.target.value) n.set('class', e.target.value); else n.delete('class'); setParams(n, { replace: true }) }}
              sx={{ minWidth: 220 }} SelectProps={{ displayEmpty: true }}>
              <MenuItem value="">All classes</MenuItem>
              {classes.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </TextField>
          )}
          <Button variant="contained" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={loading || !sheet?.cards.length}>
            Print {sheet?.cards.length ? `${sheet.cards.length} ${sheet.cards.length === 1 ? 'card' : 'cards'}` : 'cards'}
          </Button>
        </Stack>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {loading ? (
        <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress /></Stack>
      ) : sheet && sheet.cards.length === 0 ? (
        <Alert severity="info">There are no active students {classId ? 'in this class' : 'yet'}.</Alert>
      ) : sheet && (
        <Box className="id-sheet" sx={{ overflowX: 'auto' }}>
          {pages.map((page, p) => (
            <Box key={p} className="id-page" sx={{
              width: '194mm', mx: 'auto', mb: 3, p: { xs: 0, sm: '0' }, bgcolor: { xs: 'transparent', sm: 'transparent' },
              display: 'grid', gridTemplateColumns: 'repeat(2, 85.6mm)', gridAutoRows: '54mm', columnGap: '6mm', rowGap: '2mm', justifyContent: 'center',
            }}>
              {page.map((c) => <Card key={c.studentId} card={c} school={sheet.school} qr={qrs[c.studentId]} />)}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
