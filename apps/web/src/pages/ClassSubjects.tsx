import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { Add as AddIcon, Close as RemoveIcon, FileUpload as ImportIcon } from '@mui/icons-material'
import { api } from '../lib/api'
import { classLabels } from '../lib/classLabels'
import BulkImportDialog, { ColumnDef } from '../components/BulkImportDialog'
import { useAuthStore } from '../store/authStore'
import { brand } from '../theme'

const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL', 'VICE_PRINCIPAL']

interface ClassRow { id: string; name: string; status?: string; createdAt?: unknown }
interface SubjectRow { id: string; name: string; code: string; status?: string }
interface TeacherRow { id: string; firstName: string; lastName: string; status?: string }
interface Assignment { id: string; classId: string; subjectId: string; teacherId: string | null }

const importColumns: ColumnDef[] = [
  { key: 'className', label: 'Class', required: true },
  { key: 'subject', label: 'Subject', required: true },
  { key: 'teacher', label: 'Teacher' },
]

const byName = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true })

export default function ClassSubjects() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const canEdit = ADMIN_ROLES.includes(useAuthStore((s) => s.user?.role) ?? '')

  const [classes, setClasses] = useState<ClassRow[]>([])
  const [subjects, setSubjects] = useState<SubjectRow[]>([])
  const [teachers, setTeachers] = useState<TeacherRow[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  // Filters live in the URL so other pages can link here (?class=… or ?subject=…).
  const [params, setParams] = useSearchParams()
  const classFilter = params.get('class') ?? ''
  const subjectFilter = params.get('subject') ?? ''
  const setFilter = (key: 'class' | 'subject', value: string) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  const [addOpen, setAddOpen] = useState(false)
  const [addClass, setAddClass] = useState('')
  const [addSubjects, setAddSubjects] = useState<string[]>([])
  const [addTeacher, setAddTeacher] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const load = async () => {
    setError('')
    try {
      const [c, s, t, a] = await Promise.all(['/classes', '/subjects', '/teachers', '/teaching-assignments'].map((u) => api.get(u)))
      setClasses(c.data.data)
      setSubjects(s.data.data)
      setTeachers(t.data.data)
      setAssignments(a.data.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load class subjects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const labels = useMemo(() => classLabels(classes), [classes])
  const activeClasses = useMemo(
    () => classes.filter((c) => c.status !== 'INACTIVE').sort((a, b) => byName(labels.get(a.id) ?? a.name, labels.get(b.id) ?? b.name)),
    [classes, labels],
  )
  const activeSubjects = useMemo(() => subjects.filter((s) => s.status !== 'INACTIVE').sort((a, b) => byName(a.name, b.name)), [subjects])
  const activeTeachers = useMemo(
    () => teachers.filter((t) => t.status !== 'INACTIVE').sort((a, b) => byName(`${a.firstName} ${a.lastName}`, `${b.firstName} ${b.lastName}`)),
    [teachers],
  )
  const classById = new Map(classes.map((c) => [c.id, c]))
  const subjectById = new Map(subjects.map((s) => [s.id, s]))
  const teacherName = (id: string | null) => {
    const t = teachers.find((x) => x.id === id)
    return t ? `${t.firstName} ${t.lastName}`.trim() : ''
  }
  const classLabel = (id: string) => {
    const c = classById.get(id)
    if (!c) return 'Unknown class'
    return c.status === 'INACTIVE' ? `${c.name} (deleted)` : labels.get(id) ?? c.name
  }
  const subjectLabel = (id: string) => {
    const s = subjectById.get(id)
    if (!s) return 'Unknown subject'
    return s.status === 'INACTIVE' ? `${s.name} (archived)` : s.name
  }

  const shown = assignments
    .filter((a) => (!classFilter || a.classId === classFilter) && (!subjectFilter || a.subjectId === subjectFilter))
    .sort((a, b) => byName(classLabel(a.classId), classLabel(b.classId)) || byName(subjectLabel(a.subjectId), subjectLabel(b.subjectId)))

  const takenForAddClass = new Set(assignments.filter((a) => a.classId === addClass).map((a) => a.subjectId))
  const addable = activeSubjects.filter((s) => !takenForAddClass.has(s.id))

  const openAdd = () => {
    setAddClass(classFilter && activeClasses.some((c) => c.id === classFilter) ? classFilter : '')
    setAddSubjects(subjectFilter ? [subjectFilter] : [])
    setAddTeacher('')
    setAddError('')
    setAddOpen(true)
  }

  const saveAdd = async () => {
    setAdding(true)
    setAddError('')
    let done = 0
    try {
      for (const subjectId of addSubjects) {
        await api.post('/teaching-assignments', { classId: addClass, subjectId, ...(addTeacher ? { teacherId: addTeacher } : {}) })
        done++
      }
      setAddOpen(false)
      setNotice(`${done} ${done === 1 ? 'subject' : 'subjects'} added to ${classLabel(addClass)}`)
      if (!classFilter) setFilter('class', addClass)
    } catch (err: any) {
      setAddError(`${done ? `${done} added. ` : ''}${err.response?.data?.message || 'Failed to add subjects'}`)
    } finally {
      setAdding(false)
      load()
    }
  }

  const changeTeacher = async (a: Assignment, teacherId: string) => {
    const previous = assignments
    setAssignments((list) => list.map((x) => (x.id === a.id ? { ...x, teacherId: teacherId || null } : x)))
    try {
      await api.patch(`/teaching-assignments/${a.id}`, { teacherId: teacherId || null })
      setNotice(teacherId ? `${teacherName(teacherId)} now teaches ${subjectLabel(a.subjectId)} in ${classLabel(a.classId)}` : 'Teacher removed')
    } catch (err: any) {
      setAssignments(previous)
      setError(err.response?.data?.message || 'Failed to change teacher')
    }
  }

  const removeAssignment = async (a: Assignment) => {
    if (!window.confirm(`Remove ${subjectLabel(a.subjectId)} from ${classLabel(a.classId)}?`)) return
    try {
      await api.delete(`/teaching-assignments/${a.id}`)
      setAssignments((list) => list.filter((x) => x.id !== a.id))
      setNotice(`${subjectLabel(a.subjectId)} removed from ${classLabel(a.classId)}`)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to remove subject')
    }
  }

  const teacherCell = (a: Assignment) =>
    canEdit ? (
      <TextField
        select
        size="small"
        value={a.teacherId ?? ''}
        onChange={(e) => changeTeacher(a, e.target.value)}
        SelectProps={{ displayEmpty: true }}
        inputProps={{ 'aria-label': `Teacher for ${subjectLabel(a.subjectId)} in ${classLabel(a.classId)}` }}
        sx={{ minWidth: 200, '& .MuiSelect-select': { color: a.teacherId ? brand.text : brand.subtle } }}
      >
        <MenuItem value=""><em>No teacher yet</em></MenuItem>
        {activeTeachers.map((t) => (
          <MenuItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</MenuItem>
        ))}
        {a.teacherId && !activeTeachers.some((t) => t.id === a.teacherId) && (
          <MenuItem value={a.teacherId}>{teacherName(a.teacherId) || 'Former teacher'}</MenuItem>
        )}
      </TextField>
    ) : (
      <Typography sx={{ fontSize: '14px', color: a.teacherId ? brand.text : brand.subtle }}>{teacherName(a.teacherId) || 'No teacher yet'}</Typography>
    )

  const removeButton = (a: Assignment) =>
    canEdit && (
      <Tooltip title="Remove from class">
        <IconButton size="small" aria-label={`Remove ${subjectLabel(a.subjectId)} from ${classLabel(a.classId)}`} onClick={() => removeAssignment(a)}>
          <RemoveIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    )

  const emptyMessage = () => {
    if (activeClasses.length === 0) return { text: 'Create your classes first.', action: 'Go to Classes', to: '/classes' }
    if (activeSubjects.length === 0) return { text: 'Add your subjects first.', action: 'Go to Subjects', to: '/subjects' }
    if (classFilter) return { text: `${classLabel(classFilter)} doesn't have any subjects yet.`, action: canEdit ? 'Add subjects' : '', to: '' }
    if (subjectFilter) return { text: `No class takes ${subjectLabel(subjectFilter)} yet.`, action: canEdit ? 'Add it to classes' : '', to: '' }
    return { text: 'No subjects have been added to classes yet.', action: canEdit ? 'Add subjects' : '', to: '' }
  }

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: 1 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>Class subjects</Typography>
        {canEdit && (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<ImportIcon />} onClick={() => setImportOpen(true)} size="small"
              sx={{ borderColor: brand.border, color: brand.text, bgcolor: brand.surface, '&:hover': { borderColor: '#d6d3c9', bgcolor: brand.surface }, whiteSpace: 'nowrap' }}>
              Import CSV
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} size="small" sx={{ whiteSpace: 'nowrap' }}
              disabled={activeClasses.length === 0 || activeSubjects.length === 0}>
              Add subjects
            </Button>
          </Stack>
        )}
      </Stack>
      <Typography sx={{ color: brand.muted, fontSize: '14.5px', mb: 3 }}>
        Which subjects each class takes, and who teaches them.
      </Typography>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
        <TextField select label="Class" value={classFilter} onChange={(e) => setFilter('class', e.target.value)}
          SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }} sx={{ width: { xs: '100%', sm: 240 } }}>
          <MenuItem value="">All classes</MenuItem>
          {activeClasses.map((c) => <MenuItem key={c.id} value={c.id}>{labels.get(c.id) ?? c.name}</MenuItem>)}
        </TextField>
        <TextField select label="Subject" value={subjectFilter} onChange={(e) => setFilter('subject', e.target.value)}
          SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }} sx={{ width: { xs: '100%', sm: 240 } }}>
          <MenuItem value="">All subjects</MenuItem>
          {activeSubjects.map((s) => <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>)}
          {subjectFilter && !activeSubjects.some((s) => s.id === subjectFilter) && (
            <MenuItem value={subjectFilter}>{subjectLabel(subjectFilter)}</MenuItem>
          )}
        </TextField>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {!loading && shown.length > 0 && (
        <Typography sx={{ fontSize: '13.5px', color: brand.muted, mb: 1, ml: 0.5 }}>
          {shown.length} {shown.length === 1 ? 'subject' : 'subjects'}
          {classFilter ? ` in ${classLabel(classFilter)}` : ''}
          {shown.filter((a) => !a.teacherId).length > 0 && ` · ${shown.filter((a) => !a.teacherId).length} without a teacher`}
        </Typography>
      )}

      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={28} /></Box>
        ) : shown.length === 0 ? (
          (() => {
            const m = emptyMessage()
            return (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Typography color="text.secondary" sx={{ mb: m.action ? 1.5 : 0 }}>{m.text}</Typography>
                {m.action && (
                  <Button variant="outlined" onClick={() => (m.to ? navigate(m.to) : openAdd())}>{m.action}</Button>
                )}
              </Box>
            )
          })()
        ) : isPhone ? (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {shown.map((a, i) => (
              <Box component="li" key={a.id} sx={{ px: 2, py: 1.5, borderTop: i === 0 ? 'none' : `1px solid ${brand.border}` }}>
                <Stack direction="row" alignItems="center">
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '15px' }} noWrap>{subjectLabel(a.subjectId)}</Typography>
                    <Typography sx={{ fontSize: '13px', color: brand.muted }}>{classLabel(a.classId)}</Typography>
                  </Box>
                  {removeButton(a)}
                </Stack>
                <Box sx={{ mt: 1, '& .MuiTextField-root': { width: '100%' } }}>{teacherCell(a)}</Box>
              </Box>
            ))}
          </Box>
        ) : (
          <TableContainer>
            <Table sx={{ '& th': { color: brand.muted, fontWeight: 600, fontSize: '13px' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Class</TableCell>
                  <TableCell>Subject</TableCell>
                  <TableCell>Teacher</TableCell>
                  {canEdit && <TableCell align="right" />}
                </TableRow>
              </TableHead>
              <TableBody>
                {shown.map((a) => (
                  <TableRow key={a.id} hover>
                    <TableCell>{classLabel(a.classId)}</TableCell>
                    <TableCell>
                      <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>{subjectLabel(a.subjectId)}</Typography>
                      <Typography sx={{ fontSize: '12px', color: brand.subtle }}>{subjectById.get(a.subjectId)?.code}</Typography>
                    </TableCell>
                    <TableCell>{teacherCell(a)}</TableCell>
                    {canEdit && <TableCell align="right">{removeButton(a)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Add subjects to a class */}
      <Dialog open={addOpen} onClose={() => !adding && setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Add subjects to a class</DialogTitle>
        <DialogContent>
          {addError && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{addError}</Alert>}
          <TextField select fullWidth label="Class" margin="dense" value={addClass}
            onChange={(e) => { setAddClass(e.target.value); setAddSubjects([]) }}>
            {activeClasses.map((c) => <MenuItem key={c.id} value={c.id}>{labels.get(c.id) ?? c.name}</MenuItem>)}
          </TextField>

          {addClass && (
            <Box sx={{ mt: 1.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Typography sx={{ fontWeight: 600, fontSize: '14px' }}>Subjects</Typography>
                {addable.length > 1 && (
                  <Button size="small" onClick={() => setAddSubjects(addSubjects.length === addable.length ? [] : addable.map((s) => s.id))}>
                    {addSubjects.length === addable.length ? 'Clear' : 'Select all'}
                  </Button>
                )}
              </Stack>
              {addable.length === 0 ? (
                <Typography sx={{ fontSize: '14px', color: brand.muted, py: 1 }}>
                  {classLabel(addClass)} already takes every subject.
                </Typography>
              ) : (
                <Box sx={{ maxHeight: 260, overflowY: 'auto', border: `1px solid ${brand.border}`, borderRadius: 2, px: 1, mt: 0.5 }}>
                  {addable.map((s) => (
                    <FormControlLabel key={s.id} sx={{ display: 'flex', mr: 0 }}
                      control={
                        <Checkbox size="small" checked={addSubjects.includes(s.id)}
                          onChange={(e) => setAddSubjects(e.target.checked ? [...addSubjects, s.id] : addSubjects.filter((x) => x !== s.id))} />
                      }
                      label={<Typography sx={{ fontSize: '14px' }}>{s.name} <Box component="span" sx={{ color: brand.subtle, fontSize: '12px' }}>{s.code}</Box></Typography>}
                    />
                  ))}
                </Box>
              )}
              <TextField select fullWidth label="Teacher (optional)" margin="normal" value={addTeacher}
                onChange={(e) => setAddTeacher(e.target.value)} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}
                helperText="Applies to all the subjects you picked. You can change each one later.">
                <MenuItem value=""><em>Choose later</em></MenuItem>
                {activeTeachers.map((t) => <MenuItem key={t.id} value={t.id}>{t.firstName} {t.lastName}</MenuItem>)}
              </TextField>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)} disabled={adding}>Cancel</Button>
          <Button variant="contained" onClick={saveAdd} disabled={adding || !addClass || addSubjects.length === 0}>
            {adding ? 'Adding…' : addSubjects.length > 1 ? `Add ${addSubjects.length} subjects` : 'Add subject'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={!!notice} autoHideDuration={3000} onClose={() => setNotice('')} message={notice} />

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={load}
        title="Import Class Subjects"
        endpoint="/teaching-assignments/bulk-import"
        columns={importColumns}
      />
    </Box>
  )
}
