import { Box, Typography } from '@mui/material'
import { TERM_LABEL } from '../lib/examsApi'
import { GRADE_STYLE } from '../lib/resultsApi'
import { ClassReport, ReportCard, ordinal } from '../lib/reportCardsApi'

const dash = (v: number | null | undefined) => (v === null || v === undefined ? '–' : String(v))
const monthRange = (from: string, to: string) => {
  const m = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { month: 'short' })
  return `${m(from)}–${m(to)}`
}

/** The printable report card. Plain, high-contrast styles so it prints well in black and white too. */
export default function CardSheet({ report, card }: { report: Omit<ClassReport, 'cards'>; card: ReportCard }) {
  const ink = '#141a15'
  const line = '#cfccc2'
  const th = { fontSize: '11px', fontWeight: 700, color: '#4d534d', textTransform: 'uppercase' as const, letterSpacing: '0.03em', padding: '7px 6px', borderBottom: `1.5px solid ${ink}`, textAlign: 'center' as const }
  const td = { fontSize: '13px', padding: '7px 6px', borderBottom: `1px solid ${line}`, textAlign: 'center' as const, fontVariantNumeric: 'tabular-nums' }
  const caMax = card.subjects[0]?.caMax ?? 40
  const examMax = card.subjects[0]?.examMax ?? 60
  const sameMax = card.subjects.every((s) => s.caMax === caMax)
  const info: [string, string][] = [
    ['Name', `${card.student.firstName} ${card.student.lastName}`],
    ['Admission no.', card.student.admissionNumber || '–'],
    ['Class', report.class.name],
    ['Term', `${TERM_LABEL[report.series.term]}, ${report.series.session}`],
    ['Position', card.position ? `${ordinal(card.position)} of ${report.ranked}` : '–'],
    ['Attendance', card.attendance.daysMarked ? `${card.attendance.daysPresent} of ${card.attendance.daysMarked} days (${monthRange(report.attendancePeriod.from, report.attendancePeriod.to)})` : 'Not recorded'],
  ]

  return (
    <Box sx={{ color: ink, fontFamily: '"Plus Jakarta Sans", Arial, sans-serif', maxWidth: 760, mx: 'auto' }}>
      {/* School header */}
      <Box sx={{ textAlign: 'center', pb: 1.5, borderBottom: `2px solid ${ink}` }}>
        {report.school.logo && <Box component="img" src={report.school.logo} alt="" sx={{ height: 56, maxWidth: 170, objectFit: 'contain', mb: 0.5 }} />}
        <Typography sx={{ fontSize: '22px', fontWeight: 800, letterSpacing: '-0.01em', color: ink }}>{report.school.name || 'School'}</Typography>
        {report.school.motto && <Typography sx={{ fontSize: '12.5px', fontStyle: 'italic', color: '#4d534d' }}>{report.school.motto}</Typography>}
        {report.school.address && <Typography sx={{ fontSize: '12.5px', color: '#4d534d' }}>{report.school.address}</Typography>}
        {(report.school.phone || report.school.email) && (
          <Typography sx={{ fontSize: '12.5px', color: '#4d534d' }}>{[report.school.phone, report.school.email].filter(Boolean).join(' · ')}</Typography>
        )}
      </Box>
      <Typography sx={{ textAlign: 'center', fontSize: '13px', fontWeight: 800, letterSpacing: '0.12em', mt: 1.25, mb: 1.75, color: ink }}>
        STUDENT REPORT · {report.series.name.toUpperCase()}
      </Typography>

      {/* Student details */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', columnGap: 2, rowGap: 1, mb: 2 }}>
        {info.map(([k, v]) => (
          <Box key={k}>
            <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: '#646b64', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}</Typography>
            <Typography sx={{ fontSize: '13.5px', fontWeight: 600, color: ink }}>{v}</Typography>
          </Box>
        ))}
      </Box>

      {/* Subjects */}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, textAlign: 'left' }}>Subject</th>
            <th style={th}>CA{sameMax ? ` (${caMax})` : ''}</th>
            <th style={th}>Exam{sameMax ? ` (${examMax})` : ''}</th>
            <th style={th}>Total (100)</th>
            <th style={th}>Grade</th>
            <th style={th}>Position</th>
            <th style={th}>Class avg</th>
            <th style={th}>Highest</th>
            <th style={th}>Lowest</th>
          </tr>
        </thead>
        <tbody>
          {card.subjects.map((s) => (
            <tr key={s.examId}>
              <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>{s.subject}</td>
              <td style={td}>{s.caMax ? dash(s.ca) : 'n/a'}</td>
              <td style={td}>{dash(s.exam)}</td>
              <td style={{ ...td, fontWeight: 700 }}>{dash(s.total)}</td>
              <td style={td}>
                {s.grade ? <span style={{ display: 'inline-block', minWidth: 22, padding: '1px 6px', borderRadius: 5, fontWeight: 700, background: GRADE_STYLE[s.grade].bg, color: GRADE_STYLE[s.grade].fg }}>{s.grade}</span> : '–'}
              </td>
              <td style={td}>{s.position ? ordinal(s.position) : '–'}</td>
              <td style={td}>{dash(s.classAverage)}</td>
              <td style={td}>{dash(s.highest)}</td>
              <td style={td}>{dash(s.lowest)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Summary */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', border: `1.5px solid ${ink}`, borderRadius: '6px', mt: 2, '& > div + div': { borderLeft: `1px solid ${line}` } }}>
        {[
          ['Total score', card.subjectsScored ? `${card.total} / ${card.subjectsScored * 100}` : '–'],
          ['Average', dash(card.average)],
          ['Overall grade', card.grade ?? '–'],
          ['Class average', dash(report.classAverage)],
        ].map(([k, v]) => (
          <Box key={k} sx={{ p: 1.25, textAlign: 'center' }}>
            <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: '#646b64', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}</Typography>
            <Typography sx={{ fontSize: '17px', fontWeight: 800, color: ink, fontVariantNumeric: 'tabular-nums' }}>{v}</Typography>
          </Box>
        ))}
      </Box>
      {card.subjectsScored < card.subjectsTotal && (
        <Typography sx={{ fontSize: '11.5px', color: '#7a4c00', mt: 0.75 }}>
          {card.subjectsTotal - card.subjectsScored} of {card.subjectsTotal} subjects have no score yet and are not counted in the average.
        </Typography>
      )}

      {/* Remarks */}
      <Box sx={{ mt: 2.25, display: 'grid', gap: 1.5 }}>
        {[
          ["Class teacher's remark", card.teacherRemark, report.class.formTeacher],
          ["Principal's remark", card.principalRemark, report.school.principalName || null],
        ].map(([k, v, who]) => (
          <Box key={k as string}>
            <Typography sx={{ fontSize: '10.5px', fontWeight: 700, color: '#646b64', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}{who ? ` · ${who}` : ''}</Typography>
            <Typography sx={{ fontSize: '13.5px', color: ink, minHeight: 22, borderBottom: `1px dotted ${line}`, pb: 0.5 }}>{v || ' '}</Typography>
          </Box>
        ))}
      </Box>

      {/* Signatures */}
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 3, mt: 4 }}>
        {['Class teacher', report.school.principalName ? `Principal · ${report.school.principalName}` : 'Principal', 'Date'].map((k) => (
          <Box key={k} sx={{ borderTop: `1px solid ${ink}`, pt: 0.5 }}>
            <Typography sx={{ fontSize: '11px', color: '#646b64' }}>{k}</Typography>
          </Box>
        ))}
      </Box>

      {/* Grade key */}
      <Typography sx={{ fontSize: '11px', color: '#646b64', mt: 2.5, textAlign: 'center' }}>
        Grades: A 70–100 · B 60–69 · C 50–59 · D 45–49 · E 40–44 · F 0–39
      </Typography>
    </Box>
  )
}
