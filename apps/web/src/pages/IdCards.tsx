import { useEffect, useMemo, useState } from 'react'
import { Alert, Box, Button, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material'
import { ArrowBack as BackIcon, Print as PrintIcon } from '@mui/icons-material'
import { useNavigate, useSearchParams } from 'react-router-dom'
import QRCode from 'qrcode'
import { api } from '../lib/api'
import { brand } from '../theme'
import { CardSheet, getCards, getStaffCards } from '../lib/gateApi'

const GREEN = '#0e5c43'
const NIGHT = '#0f2a24'

/** What one card shows, for a student or a staff member. */
interface Face { id: string; badge: string; firstName: string; lastName: string; rows: [string, string][]; photo: string | null; qr: string }

/** One credit-card-size ID card (85.6 × 54 mm). */
function Card({ card, school, qr }: { card: Face; school: CardSheet['school']; qr: string | undefined }) {
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
        <Typography sx={{ ml: 'auto', fontSize: '2.2mm', fontWeight: 800, letterSpacing: '0.3mm', color: '#3fb68b', flexShrink: 0 }}>{card.badge}</Typography>
      </Box>
      <Box sx={{ flex: 1, display: 'flex', gap: '2.5mm', px: '3mm', py: '2.2mm', minHeight: 0 }}>
        <Box sx={{ width: '17mm', height: '21mm', flexShrink: 0, borderRadius: '1.5mm', overflow: 'hidden', bgcolor: '#eef3ec', border: '0.25mm solid #d9d6cc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {card.photo
            ? <Box component="img" src={card.photo} alt="" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <Typography sx={{ fontSize: '6mm', fontWeight: 800, color: GREEN }}>{(card.firstName[0] ?? '') + (card.lastName[0] ?? '')}</Typography>}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <Typography sx={{ fontSize: '3.6mm', fontWeight: 800, color: NIGHT, lineHeight: 1.1, wordBreak: 'break-word' }}>{card.firstName} {card.lastName}</Typography>
          <Box sx={{ mt: '1.5mm', display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: '1.5mm', rowGap: '0.6mm', fontSize: '2.6mm' }}>
            {card.rows.map(([k, v]) => [
              <Box key={`${k}-k`} component="span" sx={{ color: '#5f6a63' }}>{k}</Box>,
              <Box key={`${k}-v`} component="span" sx={{ fontWeight: 700, color: NIGHT, wordBreak: 'break-word' }}>{v || '—'}</Box>,
            ])}
          </Box>
          <Typography sx={{ mt: 'auto', fontSize: '2.1mm', color: '#5f6a63', lineHeight: 1.3 }}>
            Scan at the gate on arrival and when leaving.{school.phone ? ` If found, call ${school.phone}.` : ''}
          </Typography>
        </Box>
        <Box sx={{ width: '23mm', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {qr ? <Box component="img" src={qr} alt={`QR code for ${card.firstName} ${card.lastName}`} sx={{ width: '23mm', height: '23mm' }} /> : <Box sx={{ width: '23mm', height: '23mm', bgcolor: '#f4f3ee' }} />}
          <Typography sx={{ fontSize: '2mm', fontFamily: 'ui-monospace, Menlo, monospace', color: '#3f4a44', mt: '0.5mm', letterSpacing: '0.1mm' }}>{card.qr}</Typography>
        </Box>
      </Box>
      <Box sx={{ height: '1.2mm', bgcolor: GREEN }} />
    </Box>
  )
}

/**
 * Printable ID cards with gate QR codes. Students: a class, the whole school, or one student (?student=).
 * Staff (`staff`): everyone, or one person (?person=).
 */
export default function IdCards({ staff = false }: { staff?: boolean }) {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const classId = staff ? '' : params.get('class') ?? ''
  const studentId = (staff ? params.get('person') : params.get('student')) ?? ''
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([])
  const [sheet, setSheet] = useState<{ school: CardSheet['school']; cards: Face[] } | null>(null)
  const [qrs, setQrs] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (staff) return
    api.get('/classes').then((r) => setClasses((r.data.data as any[]).filter((c) => c.status !== 'INACTIVE').map((c) => ({ id: c.id, name: c.name })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })))).catch(() => {})
  }, [])

  useEffect(() => {
    setLoading(true)
    setError('')
    const load = staff
      ? getStaffCards().then((s) => ({ school: s.school, cards: s.cards.map((c): Face => ({ id: c.key, badge: 'STAFF ID', firstName: c.firstName, lastName: c.lastName, rows: [['Role', c.role], ['Staff no.', c.number]], photo: null, qr: c.qr })) }))
      : getCards(studentId ? undefined : classId || undefined).then((s) => ({ school: s.school, cards: s.cards.map((c): Face => ({ id: c.studentId, badge: 'STUDENT ID', firstName: c.firstName, lastName: c.lastName, rows: [['Class', c.className], ['Adm. no.', c.admissionNumber]], photo: c.photo, qr: c.qr })) }))
    load
      .then(async (s) => {
        const cards = studentId ? s.cards.filter((c) => c.id === studentId) : s.cards
        setSheet({ ...s, cards })
        const entries = await Promise.all(cards.map(async (c) => [c.id, await QRCode.toDataURL(c.qr, { margin: 1, width: 300, errorCorrectionLevel: 'M', color: { dark: NIGHT, light: '#ffffff' } })] as const))
        setQrs(Object.fromEntries(entries))
      })
      .catch((err) => setError(err.response?.data?.message || "Couldn't load the cards."))
      .finally(() => setLoading(false))
  }, [classId, studentId, staff])

  const pages = useMemo(() => {
    const cards = sheet?.cards ?? []
    const out: Face[][] = []
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
        <Typography variant="h4">{staff ? 'Staff ID cards' : 'Student ID cards'}</Typography>
        <Typography sx={{ color: brand.muted, fontSize: '14.5px', mb: 2 }}>
          Each card's QR code is scanned at the gate to clock {staff ? 'the staff member' : 'the student'} in and out. Print on card stock, 10 per A4 page, then cut along the edges.
        </Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          {!studentId && !staff && (
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
        <Alert severity="info">{staff ? 'There are no staff yet. Add teachers on the Teachers page.' : `There are no active students ${classId ? 'in this class' : 'yet'}.`}</Alert>
      ) : sheet && (
        <Box className="id-sheet" sx={{ overflowX: 'auto' }}>
          {pages.map((page, p) => (
            <Box key={p} className="id-page" sx={{
              width: '194mm', mx: 'auto', mb: 3, p: { xs: 0, sm: '0' }, bgcolor: { xs: 'transparent', sm: 'transparent' },
              display: 'grid', gridTemplateColumns: 'repeat(2, 85.6mm)', gridAutoRows: '54mm', columnGap: '6mm', rowGap: '2mm', justifyContent: 'center',
            }}>
              {page.map((c) => <Card key={c.id} card={c} school={sheet.school} qr={qrs[c.id]} />)}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}
