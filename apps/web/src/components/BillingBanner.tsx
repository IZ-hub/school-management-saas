import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Box, Button, Typography } from '@mui/material'
import { BillingInfo, daysUntil, getBillingStatus, prettyDate } from '../lib/billingApi'
import { naira } from '../lib/feesApi'
import { ADMIN_ROLES } from '../lib/roles'
import { useAuthStore } from '../store/authStore'

/** A slim notice across the top for staff: trial ending, payment due, or read-only. Silent when all is well. */
export default function BillingBanner() {
  const navigate = useNavigate()
  const location = useLocation()
  const isAdmin = ADMIN_ROLES.includes(useAuthStore((s) => s.user?.role) ?? '')
  const [b, setB] = useState<BillingInfo | null>(null)

  // Refresh when moving between pages so a payment shows straight away.
  useEffect(() => { getBillingStatus().then(setB).catch(() => setB(null)) }, [location.pathname])

  if (!b || !b.paymentsEnabled || location.pathname === '/billing') return null
  const left = daysUntil(b.trialEndsOn)
  let text = ''
  let tone: 'info' | 'warn' | 'stop' = 'info'
  if (b.status === 'TRIAL' && left <= 5) text = `Your free trial ends in ${left} ${left === 1 ? 'day' : 'days'} (${prettyDate(b.trialEndsOn)}).`
  else if (b.status === 'DUE') { text = `${naira(b.estimate)} is due for this term. Please pay by ${prettyDate(b.readOnlyFrom!)} to avoid read-only.`; tone = 'warn' }
  else if (b.status === 'READ_ONLY') { text = 'Your SchoolBricks subscription is overdue, so your school is read-only. You can view and print, but not make changes.'; tone = 'stop' }
  if (!text) return null

  const colours = { info: { bg: '#e6ebf2', fg: '#36485e' }, warn: { bg: '#fdf0d5', fg: '#7a4c00' }, stop: { bg: '#fbe4e2', fg: '#9b2a22' } }[tone]
  return (
    <Box role="status" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', px: { xs: 2, md: 4 }, py: 1, bgcolor: colours.bg, color: colours.fg }}>
      <Typography sx={{ fontSize: '13.5px', fontWeight: 600, flex: 1, minWidth: 220 }}>{text}{!isAdmin && ' Please let your school admin know.'}</Typography>
      {isAdmin && <Button size="small" variant="contained" onClick={() => navigate('/billing')} sx={{ bgcolor: colours.fg, '&:hover': { bgcolor: colours.fg } }}>{b.status === 'TRIAL' ? 'See billing' : 'Pay now'}</Button>}
    </Box>
  )
}
