import { useEffect, useState } from 'react'
import { Box, FormHelperText, FormLabel, MenuItem, Stack, TextField } from '@mui/material'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const daysIn = (year: number, month: number) => new Date(Date.UTC(year || 2000, month, 0)).getUTCDate()
const pad = (n: number) => String(n).padStart(2, '0')

interface Props {
  label?: string
  /** 'YYYY-MM-DD', or '' while incomplete. */
  value: string
  onChange: (value: string) => void
  /** Youngest and oldest age offered in the Year list. */
  minAge?: number
  maxAge?: number
  required?: boolean
  /** The faded example in the empty Year list. */
  yearExample?: string
}

/**
 * Day / Month / Year dropdowns instead of a calendar, so a birth year is one pick away
 * rather than many taps back through a date picker. Reports a date only once all three are chosen.
 */
export default function DateOfBirthField({ label = 'Date of Birth', value, onChange, minAge = 1, maxAge = 30, required, yearExample = '2015' }: Props) {
  const parse = (v: string) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
    return m ? { y: m[1], mo: String(Number(m[2])), d: String(Number(m[3])) } : { y: '', mo: '', d: '' }
  }
  const [parts, setParts] = useState(() => parse(value))

  // Follow the value when the form is reset or filled for editing.
  useEffect(() => {
    const p = parse(value)
    if (value || (parts.y && parts.mo && parts.d)) setParts(p)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  const thisYear = new Date().getFullYear()
  const years: number[] = []
  for (let y = thisYear - minAge; y >= thisYear - maxAge; y--) years.push(y)
  // Keep an existing date selectable even if it falls outside the usual range.
  if (parts.y && !years.includes(Number(parts.y))) years.push(Number(parts.y))

  const maxDay = parts.mo ? daysIn(Number(parts.y), Number(parts.mo)) : 31

  const update = (next: { y: string; mo: string; d: string }) => {
    // A 31st that no longer exists (e.g. after switching to February) is pulled back to the last day.
    if (next.d && next.mo && Number(next.d) > daysIn(Number(next.y), Number(next.mo))) next = { ...next, d: String(daysIn(Number(next.y), Number(next.mo))) }
    setParts(next)
    onChange(next.y && next.mo && next.d ? `${next.y}-${pad(Number(next.mo))}-${pad(Number(next.d))}` : '')
  }

  const incomplete = !!(parts.y || parts.mo || parts.d) && !(parts.y && parts.mo && parts.d)
  // An empty list shows a faded example, like the text fields do.
  const menu = (example: string, show: (v: string) => string = (v) => v) => ({
    MenuProps: { PaperProps: { sx: { maxHeight: 300 } } },
    displayEmpty: true,
    renderValue: (v: unknown) => (v ? show(String(v)) : <Box component="span" sx={{ opacity: 0.42 }}>{example}</Box>),
  })

  return (
    <Box sx={{ width: '100%', mt: 1.25, mb: 2 }}>
      <FormLabel required={required} sx={{ fontSize: '0.85rem', display: 'block', mb: 1.25 }}>{label}</FormLabel>
      <Stack direction="row" spacing={1}>
        <TextField select label="Day" value={parts.d} onChange={(e) => update({ ...parts, d: e.target.value })} SelectProps={menu('e.g. 14')} sx={{ flex: '0 0 26%' }}>
          {Array.from({ length: maxDay }, (_, i) => <MenuItem key={i + 1} value={String(i + 1)}>{i + 1}</MenuItem>)}
        </TextField>
        <TextField select label="Month" value={parts.mo} onChange={(e) => update({ ...parts, mo: e.target.value })} SelectProps={menu('e.g. March', (v) => MONTHS[Number(v) - 1])} sx={{ flex: 1, minWidth: 0 }}>
          {MONTHS.map((m, i) => <MenuItem key={m} value={String(i + 1)}>{m}</MenuItem>)}
        </TextField>
        <TextField select label="Year" value={parts.y} onChange={(e) => update({ ...parts, y: e.target.value })} SelectProps={menu(`e.g. ${yearExample}`)} sx={{ flex: '0 0 30%' }}>
          {years.map((y) => <MenuItem key={y} value={String(y)}>{y}</MenuItem>)}
        </TextField>
      </Stack>
      {incomplete && <FormHelperText>Choose the day, month and year.</FormHelperText>}
    </Box>
  )
}
