import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Box, Button, CircularProgress, IconButton, Menu, MenuItem, Paper, Stack, TextField, Typography } from '@mui/material'
import {
  BadgeOutlined as BadgeIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Download as DownloadIcon,
  MoreVert as MoreIcon,
} from '@mui/icons-material'
import Papa from 'papaparse'
import { brand } from '../theme'
import { StaffDay, getStaffDay, reissueStaffCard } from '../lib/gateApi'

const lagosToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' })
const shiftDay = (iso: string, days: number) => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const longDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

type Row = StaffDay['staff'][number]
const STATUS = {
  LATE: { label: 'Late', bg: '#fdf0d5', fg: '#7a4c00' },
  ON_TIME: { label: 'On time', bg: '#e3f4ec', fg: '#0b4a36' },
  NOT_IN: { label: 'Not in', bg: '#efeee8', fg: '#646b64' },
}
const statusOf = (r: Row) => (r.late ? STATUS.LATE : r.clockIn || r.clockOut ? STATUS.ON_TIME : STATUS.NOT_IN)

/** Staff clock-in and clock-out for a day, from the gate scans of their ID cards. */
export default function StaffAttendance() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const today = lagosToday()
  const date = params.get('date') || today
  const setDate = (d: string) => setParams(d && d !== today ? { date: d } : {}, { replace: true })
  const [day, setDay] = useState<StaffDay | null>(null)
  const [error, setError] = useState('')
  const [menu, setMenu] = useState<{ el: HTMLElement; row: Row } | null>(null)

  useEffect(() => {
    setDay(null)
    setError('')
    getStaffDay(date).then(setDay).catch((err) => setError(err.response?.data?.message || "Couldn't load staff attendance."))
  }, [date])

  // Who arrived first at the top; those not in yet after them.
  const rows = useMemo(() => [...(day?.staff ?? [])].sort((a, b) =>
    (a.clockIn ?? a.clockOut ?? '99').localeCompare(b.clockIn ?? b.clockOut ?? '99') || `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`)), [day])

  const download = () => {
    if (!day) return
    const csv = '﻿' + Papa.unparse({
      fields: ['Name', 'Role', 'Staff no.', 'Clocked in', 'Clocked out', 'Status'],
      data: rows.map((r) => [`${r.firstName} ${r.lastName}`.trim(), r.role, r.number, r.clockIn ?? '', r.clockOut ?? '', statusOf(r).label]),
    })
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `staff-attendance-${day.date}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const replaceCard = async (r: Row) => {
    setMenu(null)
    if (!window.confirm(`Replace ${r.firstName}'s ID card? The old card will stop working at the gate, and you'll print a new one.`)) return
    try {
      await reissueStaffCard(r.key)
      navigate(`/staff/id-cards?person=${r.key}`)
    } catch (err: any) {
      setError(err.response?.data?.message || "Couldn't replace the card.")
    }
  }

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1000, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} sx={{ mb: 2.5 }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4">Staff attendance</Typography>
          <Typography sx={{ color: brand.muted, fontSize: '14.5px' }}>When each member of staff clocked in and out at the gate with their ID card.</Typography>
        </Box>
        <Button variant="outlined" startIcon={<BadgeIcon />} onClick={() => navigate('/staff/id-cards')} sx={{ whiteSpace: 'nowrap' }}>Staff ID cards</Button>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
          <Stack direction="row" spacing={0.5} alignItems="center">
            <IconButton aria-label="Previous day" onClick={() => setDate(shiftDay(date, -1))}><PrevIcon /></IconButton>
            <TextField type="date" size="small" label="Date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} InputLabelProps={{ shrink: true }} inputProps={{ max: today }} />
            <IconButton aria-label="Next day" disabled={date >= today} onClick={() => setDate(shiftDay(date, 1))}><NextIcon /></IconButton>
          </Stack>
          <Typography sx={{ flexGrow: 1, fontWeight: 600 }}>{date === today ? `Today · ${longDay(date)}` : longDay(date)}</Typography>
          <Button size="small" startIcon={<DownloadIcon />} onClick={download} disabled={!day || rows.length === 0}>Download</Button>
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {!day && !error ? (
        <Stack alignItems="center" sx={{ py: 6 }}><CircularProgress size={28} /></Stack>
      ) : day && (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: 1.5, mb: 2 }}>
            {[
              { label: 'Staff', value: day.total },
              { label: 'Clocked in', value: day.arrived },
              { label: 'Late', value: day.late },
              { label: date === today ? 'Not in yet' : 'Did not clock in', value: day.notIn },
            ].map((t) => (
              <Paper key={t.label} sx={{ p: { xs: 1.5, sm: 2 } }}>
                <Typography sx={{ fontSize: { xs: '24px', sm: '28px' }, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{t.value}</Typography>
                <Typography sx={{ fontSize: '12.5px', color: brand.muted }}>{t.label}</Typography>
              </Paper>
            ))}
          </Box>

          <Paper>
            {rows.length === 0 ? (
              <Typography sx={{ p: 3, color: brand.muted, textAlign: 'center' }}>No staff yet. Add teachers on the Teachers page, or staff accounts on the Staff accounts page.</Typography>
            ) : rows.map((r, i) => {
              const st = statusOf(r)
              return (
                <Stack key={r.key} direction="row" alignItems="center" spacing={1.5} sx={{ px: { xs: 1.5, sm: 2.5 }, py: 1.25, borderTop: i ? `1px solid ${brand.border}` : 'none' }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 600, fontSize: '14.5px' }}>{r.firstName} {r.lastName}</Typography>
                    <Typography noWrap sx={{ fontSize: '12.5px', color: brand.muted }}>{[r.role, r.number].filter(Boolean).join(' · ')}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                    <Typography sx={{ fontSize: '13.5px' }}>In <b>{r.clockIn ?? '—'}</b></Typography>
                    <Typography sx={{ fontSize: '13.5px', color: brand.muted }}>Out <b>{r.clockOut ?? '—'}</b></Typography>
                  </Box>
                  <Box component="span" sx={{ width: 64, textAlign: 'center', flexShrink: 0, px: 1, py: 0.3, borderRadius: 999, fontSize: '12px', fontWeight: 700, bgcolor: st.bg, color: st.fg }}>{st.label}</Box>
                  <IconButton size="small" aria-label={`Card options for ${r.firstName} ${r.lastName}`} onClick={(e) => setMenu({ el: e.currentTarget, row: r })}><MoreIcon fontSize="small" /></IconButton>
                </Stack>
              )
            })}
          </Paper>
        </>
      )}

      <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem onClick={() => { const key = menu!.row.key; setMenu(null); navigate(`/staff/id-cards?person=${key}`) }}>Print ID card</MenuItem>
        <MenuItem onClick={() => replaceCard(menu!.row)}>Replace lost card</MenuItem>
      </Menu>
    </Box>
  )
}
