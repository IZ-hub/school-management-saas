import { useEffect, useState } from 'react'
import { Box, ButtonBase, Skeleton, Stack, Tooltip, Typography } from '@mui/material'
import { WarningAmberRounded as WarningIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import { brand } from '../theme'

interface ClassSize {
  id: string
  name: string
  capacity: number | null
  students: number
}

interface ClassSizes {
  classes: ClassSize[]
  withoutClass: number
  totalStudents: number
}

// One hue for "how full": fill and a lighter step of the same green for the track.
// Brand lemon fill; over capacity switches to amber, always with an icon and words so colour is never the only cue.
const FILL = '#7ac735'
const TRACK = '#eaf1e2'
const OVER = '#e8a019'

const plural = (n: number, one: string, many: string) => `${n.toLocaleString('en-NG')} ${n === 1 ? one : many}`

/** Dashboard panel: how many students are in each class, against its capacity. */
export default function StudentsByClass() {
  const navigate = useNavigate()
  const [data, setData] = useState<ClassSizes | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    api
      .get('/dashboard/class-sizes')
      .then((res) => setData(res.data.data))
      .catch(() => setFailed(true))
  }, [])

  if (failed) return null

  // Classes without a capacity are drawn against the largest class, so bars still compare.
  const largest = Math.max(1, ...(data?.classes.map((c) => c.students) ?? [1]))

  return (
    <Box sx={{ bgcolor: brand.surface, border: `1px solid ${brand.border}`, borderRadius: '14px', p: { xs: 2, sm: 2.5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'baseline' }} spacing={0.5} sx={{ mb: 2 }}>
        <Typography component="h2" sx={{ fontSize: '15px', fontWeight: 700, color: brand.text }}>Students by class</Typography>
        {data && (
          <Typography sx={{ fontSize: '13px', color: brand.muted }}>
            {plural(data.totalStudents, 'student', 'students')} in {plural(data.classes.length, 'class', 'classes')}
          </Typography>
        )}
      </Stack>

      {!data ? (
        [0, 1, 2].map((i) => <Skeleton key={i} height={28} sx={{ mb: 0.5 }} />)
      ) : data.classes.length === 0 ? (
        <Typography sx={{ fontSize: '14px', color: brand.muted }}>
          No classes yet.{' '}
          <Box component="span" role="link" tabIndex={0} onClick={() => navigate('/classes')} onKeyDown={(e) => e.key === 'Enter' && navigate('/classes')}
            sx={{ color: brand.green, fontWeight: 600, cursor: 'pointer' }}>
            Create your classes
          </Box>
        </Typography>
      ) : (
        <Box
          component="ul"
          sx={{
            listStyle: 'none', m: 0, p: 0,
            display: 'grid', columnGap: 4, rowGap: 0.25, alignContent: 'start',
            // Two columns for longer lists, filled top-to-bottom so classes keep their school order.
            ...(data.classes.length > 6
              ? {
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gridTemplateRows: { md: `repeat(${Math.ceil(data.classes.length / 2)}, auto)` },
                  gridAutoFlow: { md: 'column' },
                }
              : { gridTemplateColumns: '1fr' }),
          }}
        >
          {data.classes.map((c) => {
            const over = c.capacity !== null && c.students > c.capacity
            const share = c.capacity ? c.students / c.capacity : c.students / largest
            const percent = c.capacity ? Math.round((c.students / c.capacity) * 100) : null
            // e.g. "SS1 — 1 Student · 31 Seats Available · 3% Full"
            const seats =
              c.capacity === null
                ? 'No Capacity Set'
                : over
                  ? `${(c.students - c.capacity).toLocaleString('en-NG')} Over Capacity`
                  : plural(c.capacity - c.students, 'Seat Available', 'Seats Available')
            const detail = [plural(c.students, 'Student', 'Students'), seats, percent !== null ? `${percent}% Full` : null]
              .filter(Boolean)
              .join(' · ')
            return (
              <Box component="li" key={c.id}>
                <Tooltip title={`${c.name} — ${detail}`} placement="top" arrow>
                  <ButtonBase
                    onClick={() => navigate(`/students?class=${c.id}`)}
                    aria-label={`${c.name} — ${detail}. View students.`}
                    sx={{
                      width: '100%', display: 'grid', alignItems: 'center', columnGap: 1.5,
                      gridTemplateColumns: { xs: '76px 1fr auto', sm: '96px 1fr auto' },
                      py: 1, px: 1, mx: -1, borderRadius: '8px', textAlign: 'left',
                      '&:hover': { bgcolor: '#f7f6f1' },
                      '&:focus-visible': { outline: `2px solid ${brand.green}`, outlineOffset: 1 },
                    }}
                  >
                    <Typography noWrap sx={{ fontSize: '14px', fontWeight: 600, color: brand.text }}>{c.name}</Typography>
                    <Box sx={{ height: 8, borderRadius: 4, bgcolor: TRACK, overflow: 'hidden' }}>
                      <Box sx={{ height: '100%', width: `${Math.min(100, share * 100)}%`, minWidth: c.students > 0 ? 8 : 0, borderRadius: 4, bgcolor: over ? OVER : FILL, transition: 'width 0.4s ease' }} />
                    </Box>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ justifySelf: 'end' }}>
                      {over && <WarningIcon sx={{ fontSize: 16, color: '#a86300' }} aria-hidden />}
                      <Typography sx={{ fontSize: '13px', color: brand.muted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                        <Box component="span" sx={{ color: brand.text, fontWeight: 600 }}>{c.students}</Box>
                        {c.capacity !== null && ` / ${c.capacity}`}
                      </Typography>
                    </Stack>
                  </ButtonBase>
                </Tooltip>
                {over && (
                  <Typography sx={{ fontSize: '12px', color: '#8a4b00', pl: { xs: '88px', sm: '108px' }, mt: -0.5, mb: 0.5 }}>
                    Over capacity by {c.students - c.capacity!}
                  </Typography>
                )}
              </Box>
            )
          })}
        </Box>
      )}

      {data && data.withoutClass > 0 && (
        <Box sx={{ mt: 1.5, pt: 1.5, borderTop: `1px solid ${brand.border}` }}>
          <Typography sx={{ fontSize: '13.5px', color: brand.muted }}>
            {plural(data.withoutClass, 'student has', 'students have')} no class yet.{' '}
            <Box component="span" role="link" tabIndex={0} onClick={() => navigate('/students?class=none')}
              onKeyDown={(e) => e.key === 'Enter' && navigate('/students?class=none')}
              sx={{ color: brand.green, fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
              Assign them
            </Box>
          </Typography>
        </Box>
      )}
    </Box>
  )
}
