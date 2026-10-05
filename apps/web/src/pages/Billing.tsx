import { useCallback, useEffect, useState } from 'react'
import { Alert, Box, Button, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { LockOutlined as LockIcon, CheckCircleRounded as OkIcon } from '@mui/icons-material'
import { TERM_LABEL } from '../lib/examsApi'
import { naira } from '../lib/feesApi'
import { BillingInfo, Invoice, daysUntil, getBilling, prettyDate, startBillingPayment, verifyBillingPayment } from '../lib/billingApi'
import { brand } from '../theme'

const STATUS = {
  TRIAL: { label: 'Free trial', bg: '#e6ebf2', fg: '#36485e' },
  ACTIVE: { label: 'Paid', bg: '#e3f1e6', fg: '#1d5f36' },
  DUE: { label: 'Payment due', bg: '#fdf0d5', fg: '#7a4c00' },
  READ_ONLY: { label: 'Read-only', bg: '#fbe4e2', fg: '#9b2a22' },
}

/** The school's SchoolBricks subscription: ₦1,500 per active student per term. */
export default function Billing() {
  const [b, setB] = useState<(BillingInfo & { invoice: Invoice | null; history: Invoice[] }) | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<{ severity: 'success' | 'info' | 'warning' | 'error'; text: string } | null>(null)
  const [paying, setPaying] = useState(false)

  const load = useCallback(() => { getBilling().then(setB).catch((err) => setError(err.response?.data?.message || 'Failed to load billing')) }, [])

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('reference')
    if (!ref) { load(); return }
    history.replaceState(null, '', '/billing')
    setNotice({ severity: 'info', text: 'Confirming your payment…' })
    verifyBillingPayment(ref)
      .then((r) => setNotice({
        SUCCESS: { severity: 'success' as const, text: 'Payment received, thank you. Your school has full access for this term.' },
        PENDING: { severity: 'warning' as const, text: 'Your payment is still being confirmed by the bank. Check back in a few minutes.' },
        FAILED: { severity: 'error' as const, text: "The payment didn't go through, so nothing was charged. You can try again." },
        REVIEW: { severity: 'warning' as const, text: 'We received your payment but need to check it. SchoolBricks will confirm shortly.' },
      }[r.status]))
      .catch((err) => setNotice({ severity: 'error', text: err.response?.data?.message || "We couldn't confirm the payment." }))
      .finally(load)
  }, [load])

  const pay = async () => {
    setPaying(true)
    setError('')
    try {
      window.location.assign((await startBillingPayment()).authorizationUrl)
    } catch (err: any) {
      setError(err.response?.data?.message || "We couldn't start the payment.")
      setPaying(false)
    }
  }

  if (!b) return <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>{error ? <Alert severity="error">{error}</Alert> : <CircularProgress size={28} />}</Box>

  const st = STATUS[b.status]
  const amount = b.invoice?.amount ?? b.estimate
  const students = b.invoice?.students ?? b.students
  const termName = `${TERM_LABEL[b.term.term]} ${b.term.session}`
  const canPay = b.paymentsEnabled && !b.paid && b.invoice?.status !== 'PAID' && amount > 0

  const headline = {
    TRIAL: `${Math.max(0, daysUntil(b.trialEndsOn))} days left in your free trial`,
    ACTIVE: `${termName} is paid`,
    DUE: `${naira(amount)} due for ${termName}`,
    READ_ONLY: 'Your school is read-only',
  }[b.status]
  const detail = {
    TRIAL: `Your trial ends on ${prettyDate(b.trialEndsOn)}. After that, ${termName} costs ${naira(b.estimate)} for your ${b.students} active ${b.students === 1 ? 'student' : 'students'}. You can pay early at any time.`,
    ACTIVE: 'Everyone has full access. The next invoice comes at the start of next term.',
    DUE: b.readOnlyFrom ? `Please pay by ${prettyDate(b.readOnlyFrom)}. After that, your school becomes read-only until payment: staff can still view and print, but not add or change anything.` : '',
    READ_ONLY: 'Staff can still view and print everything, and parents can still see their children. Pay now to add and change records again. Nothing has been deleted.',
  }[b.status]

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 880, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Typography variant="h4">Billing</Typography>
      <Typography sx={{ color: brand.muted, fontSize: '14.5px', mb: 3 }}>SchoolBricks costs {naira(b.pricePerStudent)} per active student, per term.</Typography>

      {notice && <Alert severity={notice.severity} sx={{ mb: 2 }} onClose={() => setNotice(null)}>{notice.text}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Paper sx={{ p: { xs: 2.5, sm: 3 }, mb: 2 }}>
        <Box component="span" sx={{ px: 1, py: 0.3, borderRadius: 999, fontSize: '12px', fontWeight: 700, bgcolor: st.bg, color: st.fg }}>{st.label}</Box>
        <Typography sx={{ fontSize: { xs: '22px', sm: '26px' }, fontWeight: 800, letterSpacing: '-0.4px', mt: 1.25 }}>{headline}</Typography>
        <Typography sx={{ fontSize: '14.5px', color: brand.muted, mt: 0.5, maxWidth: 640 }}>{detail}</Typography>

        {!b.paid && amount > 0 && (
          <Box sx={{ mt: 2.5, border: `1px solid ${brand.border}`, borderRadius: '12px', p: 2, bgcolor: '#fbfaf6', maxWidth: 460 }}>
            <Typography sx={{ fontSize: '13px', color: brand.muted }}>{termName}</Typography>
            <Stack direction="row" justifyContent="space-between" sx={{ mt: 0.75 }}>
              <Typography sx={{ fontSize: '14px' }}>{students} active {students === 1 ? 'student' : 'students'} × {naira(b.pricePerStudent)}</Typography>
              <Typography sx={{ fontSize: '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{naira(amount)}</Typography>
            </Stack>
            {b.invoice && <Typography sx={{ fontSize: '12px', color: brand.subtle, mt: 0.75 }}>Counted when this term's invoice was created. Students added later are included from next term.</Typography>}
          </Box>
        )}

        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 2.5 }}>
          {canPay && (
            <Button variant="contained" size="large" startIcon={<LockIcon />} onClick={pay} disabled={paying}>
              {paying ? 'Opening Paystack…' : `Pay ${naira(amount)} with Paystack`}
            </Button>
          )}
          {b.paid && <Stack direction="row" spacing={1} alignItems="center" sx={{ color: '#1d5f36' }}><OkIcon /><Typography sx={{ fontWeight: 600 }}>Thank you for paying</Typography></Stack>}
        </Stack>
        {!b.paymentsEnabled && !b.paid && (
          <Alert severity="info" sx={{ mt: 2 }}>Online payment for SchoolBricks isn't switched on yet, so nothing is locked. SchoolBricks will contact you about payment.</Alert>
        )}
      </Paper>

      <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
        <Typography component="h2" sx={{ fontSize: '15px', fontWeight: 700, mb: 1.25 }}>Invoices</Typography>
        {b.history.length === 0 ? (
          <Typography sx={{ fontSize: '14px', color: brand.muted }}>No invoices yet. The first one is created when your trial ends.</Typography>
        ) : b.history.map((i, k) => (
          <Stack key={i.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 1, borderTop: k ? `1px solid ${brand.border}` : 'none' }}>
            <Box>
              <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>{TERM_LABEL[i.term]} {i.session}</Typography>
              <Typography sx={{ fontSize: '12.5px', color: brand.subtle }}>{i.students} students × {naira(1500)}</Typography>
            </Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography sx={{ fontSize: '14px', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{naira(i.amount)}</Typography>
              <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 999, fontSize: '12px', fontWeight: 600, ...(i.status === 'PAID' ? { bgcolor: '#e3f1e6', color: '#1d5f36' } : { bgcolor: '#fdf0d5', color: '#7a4c00' }) }}>
                {i.status === 'PAID' ? 'Paid' : 'Open'}
              </Box>
            </Stack>
          </Stack>
        ))}
      </Paper>
    </Box>
  )
}
