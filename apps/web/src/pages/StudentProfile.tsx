import { ReactNode, useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Alert, Avatar, Box, Button, ButtonBase, CircularProgress, Paper, Stack, Typography } from '@mui/material'
import { ArrowBack as BackIcon, FamilyRestroomOutlined as ParentIcon, PaymentsOutlined as PayIcon, ArticleOutlined as CardIcon, ReceiptLongOutlined as StatementIcon } from '@mui/icons-material'
import { toDate } from '../lib/attendanceApi'
import { TERM_LABEL } from '../lib/examsApi'
import { METHOD_LABEL, Receipt, naira } from '../lib/feesApi'
import { GRADE_STYLE } from '../lib/resultsApi'
import { StudentProfile as Profile, getStudentProfile } from '../lib/profileApi'
import { ReceiptDialog, RecordPaymentDialog, StatementDialog, StatusBadge, longDate } from '../components/FeesKit'
import ParentAccessDialog from '../components/ParentAccessDialog'
import { brand } from '../theme'

const DAY_STYLE = {
  ABSENT: { label: 'Absent', bg: '#fbe4e2', fg: '#9b2a22' },
  LATE: { label: 'Late', bg: '#fdf0d5', fg: '#7a4c00' },
  EXCUSED: { label: 'Excused', bg: '#e6ebf2', fg: '#36485e' },
} as const
const PARENT_STATUS = { ACTIVE: 'Active', INVITED: 'Invited', DISABLED: 'Removed' }

const age = (dob: string | null) => {
  if (!dob) return null
  const d = new Date(`${dob}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--
  return a >= 0 ? a : null
}
const titleCase = (v: string | null) => (v ? v.charAt(0) + v.slice(1).toLowerCase() : null)
const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Paper sx={{ p: { xs: 2, sm: 2.5 } }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.25 }}>
        <Typography component="h2" sx={{ fontSize: '15px', fontWeight: 700 }}>{title}</Typography>
        {action}
      </Stack>
      {children}
    </Paper>
  )
}

function Row({ k, v }: { k: string; v: ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" spacing={2} sx={{ py: 0.6, borderBottom: `1px solid ${brand.border}`, '&:last-child': { borderBottom: 'none' } }}>
      <Typography sx={{ fontSize: '13.5px', color: brand.muted }}>{k}</Typography>
      <Typography sx={{ fontSize: '13.5px', fontWeight: 600, textAlign: 'right', wordBreak: 'break-word' }}>{v || '–'}</Typography>
    </Stack>
  )
}

export default function StudentProfile() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const [p, setP] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  const [parentOpen, setParentOpen] = useState(false)
  const [statementOpen, setStatementOpen] = useState(false)
  const [payOpen, setPayOpen] = useState(false)
  const [receipt, setReceipt] = useState<Receipt | null>(null)

  const load = useCallback(() => {
    getStudentProfile(id).then(setP).catch((err) => setError(err.response?.status === 404 ? 'This student was not found.' : err.response?.data?.message || 'Failed to load the student'))
  }, [id])
  useEffect(() => { setP(null); load() }, [load])

  if (!p) {
    return (
      <Box sx={{ maxWidth: 1120, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
        <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 2, ml: -1, color: brand.muted }}>Back</Button>
        {error ? <Alert severity="error">{error}</Alert> : <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress size={28} /></Box>}
      </Box>
    )
  }

  const s = p.student
  const years = age(s.dateOfBirth)
  const left = s.status === 'INACTIVE'
  const f = p.fees?.current
  const a = p.attendance

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1120, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Button startIcon={<BackIcon />} onClick={() => navigate(-1)} sx={{ mb: 1.5, ml: -1, color: brand.muted }}>Back</Button>

      {/* Header */}
      <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ md: 'center' }}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ width: 64, height: 64, bgcolor: brand.greenSoft, color: brand.green, fontSize: '22px', fontWeight: 700 }}>
              {(s.firstName[0] ?? '') + (s.lastName[0] ?? '')}
            </Avatar>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Typography variant="h4" sx={{ fontSize: { xs: '22px', sm: '26px' } }}>{s.firstName} {s.lastName}</Typography>
                <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 999, fontSize: '12px', fontWeight: 600, bgcolor: left ? '#efeee8' : '#e3f1e6', color: left ? '#646b64' : '#1d5f36' }}>
                  {left ? (s.leftReason === 'GRADUATED' ? `Graduated${s.leftSession ? ` · ${s.leftSession}` : ''}` : 'Left the school') : 'Active'}
                </Box>
              </Stack>
              <Typography sx={{ fontSize: '14px', color: brand.muted }}>
                {[p.class?.name, s.admissionNumber, titleCase(s.gender), years !== null ? `${years} years old` : null].filter(Boolean).join(' · ')}
              </Typography>
              {p.class?.formTeacher && <Typography sx={{ fontSize: '13px', color: brand.subtle }}>Form teacher: {p.class.formTeacher}</Typography>}
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {p.can.admin && !left && <Button variant="outlined" startIcon={<ParentIcon />} onClick={() => setParentOpen(true)}>Parent access</Button>}
            {p.can.finance && f?.feesSet && f.balance > 0 && <Button variant="contained" startIcon={<PayIcon />} onClick={() => setPayOpen(true)}>Record payment</Button>}
          </Stack>
        </Stack>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2, alignItems: 'start' }}>
        {/* Attendance */}
        {a && (
          <Section title={`Attendance · ${TERM_LABEL[p.term.term]}`}>
            <Stack direction="row" spacing={3} alignItems="baseline" sx={{ mb: 1.25 }}>
              <Typography sx={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.5px' }}>{a.rate !== null ? `${a.rate}%` : '—'}</Typography>
              <Typography sx={{ fontSize: '13px', color: brand.muted }}>
                {a.rate === null ? 'No registers yet this term' : `Present ${a.present} · Late ${a.late} · Absent ${a.absent}${a.excused ? ` · Excused ${a.excused}` : ''}`}
              </Typography>
            </Stack>
            {a.notable.length > 0 ? (
              <Stack spacing={0.5}>
                {a.notable.map((d) => (
                  <Stack key={d.date} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: '13.5px' }}>{shortDay(d.date)}</Typography>
                    <Box component="span" sx={{ px: 1, py: 0.2, borderRadius: 999, fontSize: '12px', fontWeight: 600, bgcolor: DAY_STYLE[d.status].bg, color: DAY_STYLE[d.status].fg }}>{DAY_STYLE[d.status].label}</Box>
                  </Stack>
                ))}
              </Stack>
            ) : a.rate !== null ? <Typography sx={{ fontSize: '13.5px', color: '#1d5f36' }}>Present every day so far this term.</Typography> : null}
          </Section>
        )}

        {/* Fees */}
        {p.fees && f && (
          <Section title={`Fees · ${TERM_LABEL[p.term.term]} ${p.term.session}`} action={<Button size="small" startIcon={<StatementIcon />} onClick={() => setStatementOpen(true)}>Statement</Button>}>
            {!f.feesSet ? (
              <Typography sx={{ fontSize: '13.5px', color: brand.muted }}>Fees for {p.class?.name ?? 'this class'} haven't been set for this term.</Typography>
            ) : (
              <>
                <Stack direction="row" spacing={2} alignItems="baseline" sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: '30px', fontWeight: 700, letterSpacing: '-0.5px', color: f.balance > 0 ? '#9b2a22' : '#1d5f36' }}>{f.balance > 0 ? naira(f.balance) : 'Paid'}</Typography>
                  <StatusBadge status={f.balance <= 0 ? 'PAID' : f.paid > 0 ? 'PART' : 'UNPAID'} />
                </Stack>
                <Typography sx={{ fontSize: '13px', color: brand.muted, mb: 1.25 }}>
                  {naira(f.paid)} paid of {naira(f.due)}{f.discount ? ` (after ${naira(f.discount.amount)} ${f.discount.reason?.toLowerCase() || 'discount'})` : ''}{f.dueDate ? ` · due ${longDate(f.dueDate)}` : ''}
                </Typography>
              </>
            )}
            {p.fees.payments.length > 0 && (
              <>
                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: brand.subtle, mb: 0.5 }}>Payments ({naira(p.fees.totalPaid)} in total)</Typography>
                {p.fees.payments.slice(0, 6).map((pay) => (
                  <Stack key={pay.id} direction="row" justifyContent="space-between" sx={{ py: 0.4, opacity: pay.voided ? 0.5 : 1 }}>
                    <Typography sx={{ fontSize: '13px', textDecoration: pay.voided ? 'line-through' : 'none' }}>
                      {longDate(pay.paidOn)} · {METHOD_LABEL[pay.method]} <Box component="span" sx={{ color: brand.subtle }}>· {TERM_LABEL[pay.term]} {pay.session} · {pay.receiptNumber}</Box>
                    </Typography>
                    <Typography sx={{ fontSize: '13px', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{naira(pay.amount)}</Typography>
                  </Stack>
                ))}
              </>
            )}
          </Section>
        )}

        {/* Results */}
        {p.results && (
          <Box sx={{ gridColumn: { md: '1 / -1' } }}>
            <Section title="Results">
              {p.results.length === 0 ? (
                <Typography sx={{ fontSize: '13.5px', color: brand.muted }}>No exam scores yet.</Typography>
              ) : (
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 1.5 }}>
                  {p.results.map((r) => (
                    <Box key={r.seriesId} sx={{ border: `1px solid ${brand.border}`, borderRadius: '12px', p: 1.75 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1} sx={{ mb: 1 }}>
                        <Box>
                          <Typography sx={{ fontSize: '14px', fontWeight: 700 }}>{r.name}</Typography>
                          <Typography sx={{ fontSize: '12px', color: brand.subtle }}>{r.scored} {r.scored === 1 ? 'subject' : 'subjects'} · {r.published ? 'Published to parents' : 'Not published'}</Typography>
                        </Box>
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography sx={{ fontSize: '20px', fontWeight: 800, lineHeight: 1.1 }}>{r.average ?? '–'}</Typography>
                          {r.grade && <Box component="span" sx={{ px: 0.75, borderRadius: '5px', fontSize: '12px', fontWeight: 700, bgcolor: GRADE_STYLE[r.grade].bg, color: GRADE_STYLE[r.grade].fg }}>{r.grade}</Box>}
                        </Box>
                      </Stack>
                      {r.subjects.map((x) => (
                        <Stack key={x.subject} direction="row" justifyContent="space-between" sx={{ py: 0.3 }}>
                          <Typography sx={{ fontSize: '13px' }}>{x.subject}</Typography>
                          <Typography sx={{ fontSize: '13px', fontVariantNumeric: 'tabular-nums' }}>
                            <b>{x.total ?? '–'}</b>{x.grade && <Box component="span" sx={{ ml: 0.75, color: GRADE_STYLE[x.grade].fg, fontWeight: 700 }}>{x.grade}</Box>}
                          </Typography>
                        </Stack>
                      ))}
                      {r.classId && (
                        <ButtonBase onClick={() => navigate(`/report-cards?exam=${r.seriesId}&class=${r.classId}&student=${s.id}`)} sx={{ mt: 1, fontSize: '13px', fontWeight: 600, color: brand.green, gap: 0.5 }}>
                          <CardIcon sx={{ fontSize: 16 }} /> Open report card
                        </ButtonBase>
                      )}
                    </Box>
                  ))}
                </Box>
              )}
            </Section>
          </Box>
        )}

        {/* Details and family */}
        <Section title="Details">
          <Row k="Admission no." v={s.admissionNumber} />
          <Row k="Date of birth" v={s.dateOfBirth ? `${longDate(s.dateOfBirth)}${years !== null ? ` (${years})` : ''}` : null} />
          <Row k="Address" v={s.address} />
          <Row k="Parent's phone" v={s.parentPhone} />
          <Row k="Parent's email" v={s.parentEmail} />
          {p.classHistory.length > 0 && (
            <Box sx={{ mt: 1.5 }}>
              <Typography sx={{ fontSize: '12px', fontWeight: 600, color: brand.subtle, mb: 0.5 }}>Class history</Typography>
              {p.classHistory.map((h) => (
                <Typography key={h.toSession} sx={{ fontSize: '13px' }}>{h.toSession}: {h.from} → <b>{h.to}</b></Typography>
              ))}
            </Box>
          )}
        </Section>

        {p.parents && (
          <Section title="Parent accounts" action={!left ? <Button size="small" onClick={() => setParentOpen(true)}>Manage</Button> : undefined}>
            {p.parents.length === 0 ? (
              <Typography sx={{ fontSize: '13.5px', color: brand.muted }}>No parent has access yet. Use "Parent access" to send a setup link.</Typography>
            ) : p.parents.map((pa) => (
              <Stack key={pa.userId} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75, borderBottom: `1px solid ${brand.border}`, '&:last-child': { borderBottom: 'none' } }}>
                <Box>
                  <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>{pa.firstName} {pa.lastName}</Typography>
                  <Typography sx={{ fontSize: '12px', color: brand.subtle }}>{[pa.email, pa.phone].filter(Boolean).join(' · ')}{pa.lastLogin ? ` · last signed in ${new Date(pa.lastLogin).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}</Typography>
                </Box>
                <Typography sx={{ fontSize: '12.5px', fontWeight: 600, color: pa.status === 'ACTIVE' ? '#1d5f36' : brand.muted }}>{PARENT_STATUS[pa.status]}</Typography>
              </Stack>
            ))}
          </Section>
        )}

        {p.messages && (
          <Box sx={{ gridColumn: { md: '1 / -1' } }}>
            <Section title="Messages sent">
              {p.messages.length === 0 ? (
                <Typography sx={{ fontSize: '13.5px', color: brand.muted }}>No messages sent about {s.firstName} yet.</Typography>
              ) : p.messages.map((m) => (
                <Box key={m.id} sx={{ py: 0.9, borderBottom: `1px solid ${brand.border}`, '&:last-child': { borderBottom: 'none' } }}>
                  <Typography sx={{ fontSize: '12px', color: brand.subtle }}>
                    {toDate(m.createdAt)?.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })}
                    {m.sms === 'SENT' ? ' · SMS sent' : m.sms === 'FAILED' ? ' · SMS failed' : m.sms === 'NO_PHONE' ? ' · no phone for SMS' : ' · parent page'}
                  </Typography>
                  <Typography sx={{ fontSize: '13.5px', whiteSpace: 'pre-wrap' }}>{m.text}</Typography>
                </Box>
              ))}
            </Section>
          </Box>
        )}
      </Box>

      {parentOpen && <ParentAccessDialog student={s} onClose={() => { setParentOpen(false); load() }} />}
      <StatementDialog studentId={statementOpen ? s.id : null} term={p.term.term} session={p.term.session} onClose={() => setStatementOpen(false)} onChanged={load}
        onRecordPayment={() => { setStatementOpen(false); setPayOpen(true) }} />
      <RecordPaymentDialog open={payOpen} studentId={s.id} term={p.term.term} session={p.term.session} onClose={() => setPayOpen(false)}
        onRecorded={(r) => { setPayOpen(false); setReceipt(r); load() }} />
      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </Box>
  )
}
