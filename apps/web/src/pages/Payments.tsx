import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  InputAdornment,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { PaymentsOutlined as PayIcon, Search as SearchIcon } from '@mui/icons-material'
import { TERM_LABEL } from '../lib/examsApi'
import { METHODS, METHOD_LABEL, Method, PaymentList, Receipt, getReceipt, listPayments, naira, voidPayment } from '../lib/feesApi'
import { ReceiptDialog, RecordPaymentDialog, TermPicker, longDate, useTermSession } from '../components/FeesKit'
import { brand } from '../theme'

export default function Payments() {
  const { term, session, set } = useTermSession()
  const [list, setList] = useState<PaymentList | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [method, setMethod] = useState<Method | ''>('')
  const [recording, setRecording] = useState(false)
  const [receipt, setReceipt] = useState<Receipt | null>(null)

  const load = useCallback(() => {
    listPayments(term, session).then(setList).catch((err) => setError(err.response?.data?.message || 'Failed to load payments'))
  }, [term, session])
  useEffect(() => { setList(null); load() }, [load])

  const shown = useMemo(() => {
    if (!list) return []
    const q = search.trim().toLowerCase()
    return list.payments.filter((p) =>
      (!method || p.method === method) &&
      (!q || `${p.studentName} ${p.admissionNumber} ${p.receiptNumber} ${p.reference ?? ''}`.toLowerCase().includes(q)),
    )
  }, [list, search, method])

  const openReceipt = async (id: string) => {
    try {
      setReceipt(await getReceipt(id))
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load the receipt')
    }
  }

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4">Payments</Typography>
          <Typography sx={{ color: brand.muted, fontSize: '14.5px' }}>Every payment gets a numbered receipt. Mistakes are voided, never deleted.</Typography>
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TermPicker term={term} session={session} onChange={set} />
          <Button variant="contained" startIcon={<PayIcon />} onClick={() => setRecording(true)}>Record payment</Button>
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {!list ? (
        <Skeleton variant="rounded" height={200} />
      ) : (
        <>
          <Paper sx={{ p: { xs: 2, sm: 2.5 }, mb: 2 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, sm: 4 }} alignItems={{ sm: 'center' }}>
              <Box>
                <Typography sx={{ fontSize: '13px', color: brand.muted }}>Collected · {TERM_LABEL[term]} {session}</Typography>
                <Typography sx={{ fontSize: '26px', fontWeight: 700, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>{naira(list.total)}</Typography>
                <Typography sx={{ fontSize: '12.5px', color: brand.subtle }}>{list.count} {list.count === 1 ? 'payment' : 'payments'}</Typography>
              </Box>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                {METHODS.filter((m) => list.byMethod[m]).map((m) => (
                  <Box key={m} sx={{ px: 1.25, py: 0.75, borderRadius: '10px', border: `1px solid ${brand.border}` }}>
                    <Typography sx={{ fontSize: '12px', color: brand.muted }}>{METHOD_LABEL[m]}</Typography>
                    <Typography sx={{ fontSize: '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{naira(list.byMethod[m]!)}</Typography>
                  </Box>
                ))}
              </Stack>
            </Stack>
          </Paper>

          <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1.5 }}>
              <TextField size="small" placeholder="Search name, receipt or reference" value={search} onChange={(e) => setSearch(e.target.value)}
                InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 18, color: brand.subtle }} /></InputAdornment> }} sx={{ width: { sm: 300 } }} />
              <TextField select size="small" value={method} onChange={(e) => setMethod(e.target.value as Method | '')} SelectProps={{ displayEmpty: true }} sx={{ width: { sm: 170 } }}>
                <MenuItem value="">All methods</MenuItem>
                {METHODS.map((m) => <MenuItem key={m} value={m}>{METHOD_LABEL[m]}</MenuItem>)}
              </TextField>
            </Stack>

            {shown.length === 0 ? (
              <Typography sx={{ color: brand.muted, fontSize: '14px', py: 3, textAlign: 'center' }}>
                {list.payments.length === 0 ? 'No payments recorded for this term yet.' : 'No payments match.'}
              </Typography>
            ) : (
              <Box role="list" sx={{ border: `1px solid ${brand.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                {shown.map((p, i) => (
                  <ButtonBase key={p.id} role="listitem" onClick={() => openReceipt(p.id)}
                    sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 2, px: { xs: 1.5, sm: 2 }, py: 1.1, textAlign: 'left', borderTop: i ? `1px solid ${brand.border}` : 'none', opacity: p.voided ? 0.6 : 1, '&:hover': { bgcolor: '#fbfaf7' } }}>
                    <Box sx={{ width: { xs: 'auto', sm: 128 }, display: { xs: 'none', sm: 'block' }, flexShrink: 0 }}>
                      <Typography sx={{ fontSize: '13px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{p.receiptNumber}</Typography>
                      <Typography sx={{ fontSize: '12px', color: brand.subtle }}>{longDate(p.paidOn)}</Typography>
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontSize: '14.5px', fontWeight: 600, textDecoration: p.voided ? 'line-through' : 'none' }}>{p.studentName}</Typography>
                      <Typography noWrap sx={{ fontSize: '12px', color: brand.subtle }}>
                        {[p.className, METHOD_LABEL[p.method], p.reference, `by ${p.recordedByName}`].filter(Boolean).join(' · ')}
                        <Box component="span" sx={{ display: { sm: 'none' } }}> · {p.receiptNumber}</Box>
                      </Typography>
                    </Box>
                    {p.voided && <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 999, fontSize: '12px', fontWeight: 700, bgcolor: '#fbe4e2', color: '#9b2a22' }}>Void</Box>}
                    <Typography sx={{ fontSize: '15px', fontWeight: 700, fontVariantNumeric: 'tabular-nums', textDecoration: p.voided ? 'line-through' : 'none' }}>{naira(p.amount)}</Typography>
                  </ButtonBase>
                ))}
              </Box>
            )}
          </Paper>
        </>
      )}

      <RecordPaymentDialog open={recording} term={term} session={session} onClose={() => setRecording(false)}
        onRecorded={(r) => { setRecording(false); setReceipt(r); load() }} />

      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)}
        onVoid={async (reason) => {
          const r = await voidPayment(receipt!.id, reason)
          setReceipt(r)
          setNotice(`${r.receiptNumber} voided`)
          load()
        }} />

      <Snackbar open={!!notice} autoHideDuration={3000} onClose={() => setNotice('')} message={notice} />
    </Box>
  )
}
