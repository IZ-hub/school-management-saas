import { useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  ButtonBase,
  CircularProgress,
  Dialog,
  DialogTitle,
  TextField,
  DialogActions,
  DialogContent,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material'
import { LogoutOutlined as SignOutIcon, PrintOutlined as PrintIcon, ArticleOutlined as CardIcon, ChevronRight, LockOutlined as LockIcon } from '@mui/icons-material'
import { signOut } from '../lib/api'
import { TERM_LABEL } from '../lib/examsApi'
import { METHOD_LABEL, naira, parseNaira } from '../lib/feesApi'
import { ChildOverview, ParentChild, getChildFees, getChildOverview, getChildReportCard, getChildren, startOnlinePayment, verifyOnlinePayment } from '../lib/parentApi'
import { PrintArea, StatementSheet, longDate, usePrint } from '../components/FeesKit'
import { parentInbox } from '../lib/messagesApi'
import { toDate } from '../lib/attendanceApi'
import CardSheet from '../components/ReportCardSheet'
import { useAuthStore } from '../store/authStore'
import { brand } from '../theme'

const DAY_STYLE = {
  PRESENT: { label: 'Present', bg: '#e3f1e6', fg: '#1d5f36' },
  LATE: { label: 'Late', bg: '#fdf0d5', fg: '#7a4c00' },
  ABSENT: { label: 'Absent', bg: '#fbe4e2', fg: '#9b2a22' },
  EXCUSED: { label: 'Excused', bg: '#e6ebf2', fg: '#36485e' },
} as const

const errorText = (err: any, fallback: string) => err?.response?.data?.message || fallback

/** A parent's view: only their own children's attendance, fees and published report cards. */
export default function ParentHome() {
  const user = useAuthStore((s) => s.user)
  const [schoolName, setSchoolName] = useState('')
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null)
  const [children, setChildren] = useState<ParentChild[] | null>(null)
  const [childId, setChildId] = useState('')
  const [overview, setOverview] = useState<ChildOverview | null>(null)
  const [error, setError] = useState('')
  const [cardFor, setCardFor] = useState<string | null>(null)
  const [statementOpen, setStatementOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [inbox, setInbox] = useState<Awaited<ReturnType<typeof parentInbox>>>([])
  useEffect(() => { parentInbox().then(setInbox).catch(() => {}) }, [])
  const [refresh, setRefresh] = useState(0)
  const [payResult, setPayResult] = useState<{ severity: 'success' | 'info' | 'warning' | 'error'; text: string } | null>(null)

  // Back from Paystack: confirm the payment, then tidy the address bar.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const reference = q.get('reference') || q.get('trxref')
    if (!reference) return
    history.replaceState(null, '', '/parent')
    setPayResult({ severity: 'info', text: 'Confirming your payment…' })
    verifyOnlinePayment(reference)
      .then((r) => {
        const text = {
          SUCCESS: `Payment of ${naira(r.amount)} received, thank you. Your receipt number is ${r.receiptNumber}.`,
          PENDING: 'Your payment is still being confirmed by the bank. Check back in a few minutes; you have not been charged twice.',
          FAILED: "The payment didn't go through, so nothing was charged. You can try again.",
          REVIEW: 'We received your payment but need to check it. The school will confirm it shortly.',
        }[r.status]
        setPayResult({ severity: r.status === 'SUCCESS' ? 'success' : r.status === 'FAILED' ? 'error' : 'warning', text })
        setRefresh((n) => n + 1)
      })
      .catch((err) => setPayResult({ severity: 'error', text: errorText(err, "We couldn't confirm your payment. If you were charged, the school will see it.") }))
  }, [])

  useEffect(() => {
    getChildren()
      .then((d) => {
        setSchoolName(d.schoolName); setSchoolLogo(d.schoolLogo); setChildren(d.children)
        const wanted = new URLSearchParams(window.location.search).get('child')
        setChildId(d.children.find((c) => c.id === wanted)?.id ?? d.children[0]?.id ?? '')
      })
      .catch((err) => { setChildren([]); setError(errorText(err, "We couldn't load your children.")) })
  }, [])

  useEffect(() => {
    if (!childId) return
    setOverview(null)
    getChildOverview(childId).then(setOverview).catch((err) => setError(errorText(err, "We couldn't load this page.")))
  }, [childId, refresh])

  const child = children?.find((c) => c.id === childId)
  const a = overview?.attendance
  const f = overview?.fees

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: brand.page }}>
      {/* Top bar */}
      <Box sx={{ borderBottom: `1px solid ${brand.border}`, bgcolor: brand.surface }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ maxWidth: 980, mx: 'auto', px: { xs: 2, sm: 3 }, py: 1.5 }}>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: 0 }}>
            {schoolLogo && <Box component="img" src={schoolLogo} alt="" sx={{ height: 36, width: 36, objectFit: 'contain' }} />}
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: '12px', fontWeight: 700, color: brand.green, letterSpacing: '0.04em' }}>SCHOOLFUL LMS</Typography>
              <Typography noWrap sx={{ fontSize: '15px', fontWeight: 700 }}>{schoolName || ' '}</Typography>
            </Box>
          </Stack>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Typography sx={{ display: { xs: 'none', sm: 'block' }, fontSize: '13.5px', color: brand.muted }}>{user?.firstName} {user?.lastName}</Typography>
            <Button size="small" startIcon={<SignOutIcon />} onClick={() => signOut()} sx={{ color: brand.muted }}>Sign out</Button>
          </Stack>
        </Stack>
      </Box>

      <Box sx={{ maxWidth: 980, mx: 'auto', px: { xs: 2, sm: 3 }, py: { xs: 3, sm: 4 } }}>
        {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
        {payResult && <Alert severity={payResult.severity} sx={{ mb: 2 }} onClose={() => setPayResult(null)}>{payResult.text}</Alert>}

        {!children ? (
          <Skeleton variant="rounded" height={160} />
        ) : children.length === 0 ? (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '16px', fontWeight: 700, mb: 0.75 }}>No children linked</Typography>
            <Typography sx={{ fontSize: '14px', color: brand.muted }}>Ask your school to give you access to your child's records.</Typography>
          </Paper>
        ) : (
          <>
            {children.length > 1 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2.5 }} role="tablist" aria-label="Your children">
                {children.map((c) => {
                  const on = c.id === childId
                  return (
                    <ButtonBase key={c.id} role="tab" aria-selected={on} onClick={() => setChildId(c.id)}
                      sx={{ px: 1.75, py: 0.9, borderRadius: 999, fontSize: '14px', fontWeight: 600, border: `1px solid ${on ? brand.green : brand.border}`, bgcolor: on ? brand.greenSoft : brand.surface, color: on ? brand.green : brand.text }}>
                      {c.firstName}{c.className ? <Box component="span" sx={{ ml: 0.75, color: brand.subtle, fontWeight: 500 }}>{c.className}</Box> : null}
                    </ButtonBase>
                  )
                })}
              </Stack>
            )}

            {child && (
              <Box sx={{ mb: 2.5 }}>
                <Typography variant="h4" sx={{ fontSize: { xs: '24px', sm: '28px' } }}>{child.firstName} {child.lastName}</Typography>
                <Typography sx={{ color: brand.muted, fontSize: '14px' }}>
                  {[child.className, child.admissionNumber, overview ? `${TERM_LABEL[overview.term]} ${overview.session}` : null].filter(Boolean).join(' · ')}
                </Typography>
              </Box>
            )}

            {!overview ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>
            ) : (
              <Stack spacing={2}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                  {/* Attendance */}
                  <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
                    <Typography sx={{ fontSize: '13px', color: brand.muted }}>Attendance this term</Typography>
                    <Typography sx={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums' }}>{a!.rate !== null ? `${a!.rate}%` : '—'}</Typography>
                    <Typography sx={{ fontSize: '13px', color: brand.muted, mb: 1.5 }}>
                      {a!.rate === null ? 'No registers taken yet this term' : `Present ${a!.present} · Late ${a!.late} · Absent ${a!.absent}${a!.excused ? ` · Excused ${a!.excused}` : ''}`}
                    </Typography>
                    {a!.recent.length > 0 && (
                      <>
                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: brand.subtle, mb: 0.75 }}>Recent days</Typography>
                        <Stack spacing={0.5}>
                          {a!.recent.slice(0, 5).map((d) => (
                            <Stack key={d.date} direction="row" justifyContent="space-between" alignItems="center">
                              <Typography sx={{ fontSize: '13.5px' }}>{new Date(`${d.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</Typography>
                              <Box component="span" sx={{ px: 1, py: 0.2, borderRadius: 999, fontSize: '12px', fontWeight: 600, bgcolor: DAY_STYLE[d.status].bg, color: DAY_STYLE[d.status].fg }}>{DAY_STYLE[d.status].label}</Box>
                            </Stack>
                          ))}
                        </Stack>
                      </>
                    )}
                  </Paper>

                  {/* Fees */}
                  <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
                    <Typography sx={{ fontSize: '13px', color: brand.muted }}>School fees this term</Typography>
                    {!f!.feesSet ? (
                      <Typography sx={{ fontSize: '14px', color: brand.muted, mt: 1 }}>Fees for this term haven't been published yet.</Typography>
                    ) : (
                      <>
                        <Typography sx={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.5px', fontVariantNumeric: 'tabular-nums', color: f!.balance > 0 ? '#9b2a22' : '#1d5f36' }}>
                          {f!.balance > 0 ? naira(f!.balance) : 'Fully paid'}
                        </Typography>
                        <Typography sx={{ fontSize: '13px', color: brand.muted, mb: 1.5 }}>
                          {f!.balance > 0 ? 'Balance to pay' : 'Thank you'} · {naira(f!.paid)} paid of {naira(f!.due)}{f!.dueDate ? ` · due ${longDate(f!.dueDate)}` : ''}
                        </Typography>
                        {f!.payments.filter((p) => !p.voided).slice(-3).reverse().map((p) => (
                          <Stack key={p.id} direction="row" justifyContent="space-between" sx={{ py: 0.4 }}>
                            <Typography sx={{ fontSize: '13.5px' }}>{longDate(p.paidOn)} · {METHOD_LABEL[p.method]}</Typography>
                            <Typography sx={{ fontSize: '13.5px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{naira(p.amount)}</Typography>
                          </Stack>
                        ))}
                        <Stack direction="row" spacing={1} sx={{ mt: 1.25 }} flexWrap="wrap" useFlexGap>
                          {overview.onlinePayments && f!.balance > 0 && (
                            <Button variant="contained" size="small" startIcon={<LockIcon />} onClick={() => setPayOpen(true)}>Pay online</Button>
                          )}
                          <Button size="small" startIcon={<PrintIcon />} onClick={() => setStatementOpen(true)}>View fee statement</Button>
                        </Stack>
                      </>
                    )}
                  </Paper>
                </Box>

                {/* Messages from school */}
                {inbox.filter((m) => m.studentId === childId).length > 0 && (
                  <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
                    <Typography sx={{ fontSize: '15px', fontWeight: 700, mb: 1 }}>Messages from school</Typography>
                    <Stack spacing={1.25}>
                      {inbox.filter((m) => m.studentId === childId).slice(0, 5).map((m) => (
                        <Box key={m.id} sx={{ pb: 1.25, borderBottom: `1px solid ${brand.border}`, '&:last-child': { borderBottom: 'none', pb: 0 } }}>
                          <Typography sx={{ fontSize: '12px', color: brand.subtle }}>{toDate(m.createdAt)?.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}</Typography>
                          <Typography sx={{ fontSize: '14px', whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                )}

                {/* Report cards */}
                <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
                  <Typography sx={{ fontSize: '15px', fontWeight: 700, mb: 1 }}>Report cards</Typography>
                  {overview.reportCards.length === 0 ? (
                    <Typography sx={{ fontSize: '14px', color: brand.muted }}>Report cards will appear here when the school publishes them.</Typography>
                  ) : (
                    <Box sx={{ border: `1px solid ${brand.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                      {overview.reportCards.map((r, i) => (
                        <ButtonBase key={r.seriesId} onClick={() => setCardFor(r.seriesId)}
                          sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 1.4, textAlign: 'left', borderTop: i ? `1px solid ${brand.border}` : 'none', '&:hover': { bgcolor: '#fbfaf7' } }}>
                          <CardIcon sx={{ color: brand.green, fontSize: 20 }} />
                          <Typography sx={{ flex: 1, fontSize: '14.5px', fontWeight: 600 }}>{r.name}</Typography>
                          <ChevronRight sx={{ color: brand.subtle }} />
                        </ButtonBase>
                      ))}
                    </Box>
                  )}
                </Paper>
              </Stack>
            )}
          </>
        )}
      </Box>

      {cardFor && childId && <ReportCardDialog childId={childId} seriesId={cardFor} onClose={() => setCardFor(null)} />}
      {statementOpen && childId && <StatementDialog childId={childId} onClose={() => setStatementOpen(false)} />}
      {payOpen && child && overview && <PayDialog child={child} balance={overview.fees.balance} onClose={() => setPayOpen(false)} />}
    </Box>
  )
}

function ReportCardDialog({ childId, seriesId, onClose }: { childId: string; seriesId: string; onClose: () => void }) {
  const { printing, print } = usePrint()
  const [data, setData] = useState<Awaited<ReturnType<typeof getChildReportCard>> | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { getChildReportCard(childId, seriesId).then(setData).catch((err) => setError(errorText(err, "We couldn't load this report card."))) }, [childId, seriesId])
  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {!data && !error && <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={26} /></Box>}
        {data && <Box sx={{ overflowX: 'auto' }}><Box sx={{ minWidth: 640 }}><CardSheet report={data} card={data.card} /></Box></Box>}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={print} disabled={!data}>Print or save as PDF</Button>
      </DialogActions>
      {data && <PrintArea active={printing}><CardSheet report={data} card={data.card} /></PrintArea>}
    </Dialog>
  )
}

function StatementDialog({ childId, onClose }: { childId: string; onClose: () => void }) {
  const { printing, print } = usePrint()
  const [data, setData] = useState<Awaited<ReturnType<typeof getChildFees>> | null>(null)
  const [error, setError] = useState('')
  useEffect(() => { getChildFees(childId).then(setData).catch((err) => setError(errorText(err, "We couldn't load the statement."))) }, [childId])
  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogContent sx={{ pt: 3 }}>
        {error && <Alert severity="error">{error}</Alert>}
        {!data && !error && <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={26} /></Box>}
        {data && <StatementSheet statement={data} />}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={print} disabled={!data}>Print</Button>
      </DialogActions>
      {data && <PrintArea active={printing}><StatementSheet statement={data} /></PrintArea>}
    </Dialog>
  )
}

function PayDialog({ child, balance, onClose }: { child: ParentChild; balance: number; onClose: () => void }) {
  const [amount, setAmount] = useState(balance.toLocaleString('en-NG'))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const value = parseNaira(amount)
  const problem = value === null ? 'Enter an amount in naira' : value < 100 ? 'The smallest online payment is ₦100' : value > balance ? `The balance is ${naira(balance)}` : ''

  const go = async () => {
    if (!value || problem) return
    setBusy(true)
    setError('')
    try {
      const { authorizationUrl } = await startOnlinePayment(child.id, value)
      window.location.assign(authorizationUrl)
    } catch (err) {
      setError(errorText(err, "We couldn't start the payment. Try again."))
      setBusy(false)
    }
  }

  return (
    <Dialog open onClose={busy ? undefined : onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>Pay {child.firstName}'s fees</DialogTitle>
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <TextField label="Amount (₦)" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,]/g, ''))} inputProps={{ inputMode: 'numeric' }}
          error={!!problem} helperText={problem || `Balance ${naira(balance)}. You can pay part now and the rest later.`} fullWidth autoFocus sx={{ mt: 1 }} />
        <Typography sx={{ fontSize: '12.5px', color: brand.subtle, mt: 1.5 }}>
          You'll pay securely on Paystack by card, bank transfer or USSD. The money goes straight to the school, and your receipt appears here.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button variant="contained" startIcon={<LockIcon />} onClick={go} disabled={!!problem || busy}>{busy ? 'Opening Paystack…' : value ? `Pay ${naira(value)}` : 'Pay'}</Button>
      </DialogActions>
    </Dialog>
  )
}
