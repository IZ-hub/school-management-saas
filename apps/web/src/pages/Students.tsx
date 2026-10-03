import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TableContainer,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Alert,
  Stack,
  Tooltip,
  CircularProgress,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileUpload as ImportIcon,
  FamilyRestroomOutlined as ParentIcon,
} from '@mui/icons-material'
import { api } from '../lib/api'
import { brand } from '../theme'
import { classLabels } from '../lib/classLabels'
import BulkImportDialog, { ColumnDef } from '../components/BulkImportDialog'
import ParentAccessDialog from '../components/ParentAccessDialog'
import { useAuthStore } from '../store/authStore'

interface Student {
  id: string
  firstName: string
  lastName: string
  dateOfBirth: string
  gender: string
  admissionNumber: string
  classId?: string | null
  section?: string | null
  parentEmail?: string | null
  parentPhone?: string | null
  address?: string | null
  status: string
}

interface ClassOption {
  id: string
  name: string
  status?: string
  createdAt?: unknown
}

const NO_CLASS = 'none'

const titleCase = (v?: string) => (v ? v.charAt(0).toUpperCase() + v.slice(1).toLowerCase() : '—')

// "2012-05-01" -> "1 May 2012"; anything else is shown as entered.
const formatDate = (v?: string) => {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return v || '—'
  const d = new Date(`${v}T00:00:00`)
  return isNaN(d.getTime()) ? v : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }: { status: string }) {
  const active = status === 'ACTIVE'
  return (
    <Box component="span" sx={{ display: 'inline-block', px: 1, py: 0.25, borderRadius: 999, fontSize: '12px', fontWeight: 600,
      bgcolor: active ? brand.greenSoft : '#f1f0ec', color: active ? brand.green : brand.muted }}>
      {titleCase(status)}
    </Box>
  )
}

const emptyForm = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: 'MALE',
  admissionNumber: '',
  classId: '',
  section: '',
  parentEmail: '',
  parentPhone: '',
  address: '',
}

export default function Students() {
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [parentFor, setParentFor] = useState<Student | null>(null)
  const canManageParents = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL', 'VICE_PRINCIPAL'].includes(useAuthStore((s) => s.user?.role) ?? '')
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))

  // Twin classes with the same name are shown as "JSS2B (copy 1)", "JSS2B (copy 2)".
  const labels = useMemo(() => classLabels(classes), [classes])
  const activeClasses = classes
    .filter((c) => c.status !== 'INACTIVE')
    .sort((a, b) => (labels.get(a.id) ?? a.name).localeCompare(labels.get(b.id) ?? b.name, undefined, { numeric: true }))
  const classNameById = new Map(
    classes.map((c) => [c.id, c.status === 'INACTIVE' ? `${c.name} (deleted)` : labels.get(c.id) ?? c.name]),
  )
  const classLabel = (student: Student) => {
    if (!student.classId) return '—'
    const name = classNameById.get(student.classId) ?? 'Unknown class'
    return student.section ? `${name} · ${student.section}` : name
  }

  // Class filter lives in the URL (?class=<id>), so the Classes page can link straight to a class's students.
  const [searchParams, setSearchParams] = useSearchParams()
  const classFilter = searchParams.get('class') ?? ''
  const setClassFilter = (value: string) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('class', value)
    else next.delete('class')
    setSearchParams(next, { replace: true })
  }
  const shown = students.filter((st) =>
    !classFilter ? true : classFilter === NO_CLASS ? !st.classId : st.classId === classFilter,
  )
  const filterName = classFilter === NO_CLASS ? 'no class' : classNameById.get(classFilter) ?? 'this class'

  const studentColumns: ColumnDef[] = [
    { key: 'firstName', label: 'First Name', required: true },
    { key: 'lastName', label: 'Last Name', required: true },
    { key: 'admissionNumber', label: 'Admission Number', required: true },
    { key: 'dateOfBirth', label: 'Date of Birth' },
    { key: 'gender', label: 'Gender' },
    { key: 'className', label: 'Class' },
    { key: 'section', label: 'Section' },
    { key: 'parentEmail', label: 'Parent Email' },
    { key: 'parentPhone', label: 'Parent Phone' },
    { key: 'address', label: 'Address' },
  ]

  const fetchStudents = async (searchTerm?: string) => {
    setLoading(true)
    setError('')
    try {
      const response = await api.get('/students', {
        params: searchTerm ? { search: searchTerm } : undefined,
      })
      setStudents(response.data.data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load students')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchStudents()
    api
      .get('/classes')
      .then((res) =>
        setClasses(
          (res.data.data as ClassOption[])
            .map((c) => ({ id: c.id, name: c.name, status: c.status, createdAt: c.createdAt }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })),
        ),
      )
      .catch(() => setClasses([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => fetchStudents(search), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const openCreateDialog = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setDialogOpen(true)
  }

  const openEditDialog = (student: Student) => {
    setEditingId(student.id)
    setForm({
      firstName: student.firstName,
      lastName: student.lastName,
      dateOfBirth: student.dateOfBirth,
      gender: student.gender,
      admissionNumber: student.admissionNumber,
      classId: student.classId || '',
      section: student.section || '',
      parentEmail: student.parentEmail || '',
      parentPhone: student.parentPhone || '',
      address: student.address || '',
    })
    setFormError('')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setFormError('')
    try {
      const payload = {
        ...form,
        classId: form.classId || undefined,
        section: form.section || undefined,
        parentEmail: form.parentEmail || undefined,
        parentPhone: form.parentPhone || undefined,
        address: form.address || undefined,
      }
      if (editingId) {
        await api.patch(`/students/${editingId}`, payload)
      } else {
        await api.post('/students', payload)
      }
      setDialogOpen(false)
      fetchStudents(search)
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save student')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deactivate this student record?')) return
    try {
      await api.delete(`/students/${id}`)
      fetchStudents(search)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete student')
    }
  }

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Students
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<ImportIcon />} onClick={() => setImportOpen(true)} size="small"
            sx={{ borderColor: brand.border, color: brand.text, bgcolor: brand.surface, '&:hover': { borderColor: '#d6d3c9', bgcolor: brand.surface }, whiteSpace: 'nowrap' }}>
            Import CSV
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog} size="small" sx={{ whiteSpace: 'nowrap' }}>
            Add Student
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 1.5 }}>
        <TextField
          select
          label="Class"
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          sx={{ width: { xs: '100%', sm: 240 }, flexShrink: 0 }}
          SelectProps={{ displayEmpty: true }}
          InputLabelProps={{ shrink: true }}
        >
          <MenuItem value="">All classes</MenuItem>
          {activeClasses.map((c) => (
            <MenuItem key={c.id} value={c.id}>{labels.get(c.id) ?? c.name}</MenuItem>
          ))}
          <MenuItem value={NO_CLASS}>No class</MenuItem>
          {classFilter && classFilter !== NO_CLASS && !activeClasses.some((c) => c.id === classFilter) && (
            <MenuItem value={classFilter}>{classNameById.get(classFilter) ?? 'Unknown class'}</MenuItem>
          )}
        </TextField>
        <TextField
          fullWidth
          placeholder="Search by name or admission number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {classFilter && !loading && (
        <Typography sx={{ fontSize: '13.5px', color: brand.muted, mb: 1, ml: 0.5 }}>
          {shown.length} {shown.length === 1 ? 'student' : 'students'} in {filterName}
        </Typography>
      )}

      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : shown.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {classFilter ? `No students in ${filterName}${search ? ' match your search' : ''}.` : 'No students found.'}
            </Typography>
          </Box>
        ) : isPhone ? (
          // Phones: one card per student instead of a table that scrolls sideways
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {shown.map((student, i) => (
              <Box component="li" key={student.id}
                sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, px: 2, py: 1.75, borderTop: i === 0 ? 'none' : `1px solid ${brand.border}` }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '15px', color: brand.text }} noWrap>
                    {student.firstName} {student.lastName}
                  </Typography>
                  <Typography sx={{ fontSize: '13px', color: brand.muted }} noWrap>
                    {student.admissionNumber} · {classLabel(student)}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
                    <StatusBadge status={student.status} />
                    <Typography sx={{ fontSize: '12.5px', color: brand.subtle }}>
                      {titleCase(student.gender)} · Born {formatDate(student.dateOfBirth)}
                    </Typography>
                  </Stack>
                </Box>
                {canManageParents && (
                  <IconButton aria-label={`Parent access for ${student.firstName} ${student.lastName}`} onClick={() => setParentFor(student)} sx={{ color: brand.muted }}>
                    <ParentIcon fontSize="small" />
                  </IconButton>
                )}
                <IconButton aria-label={`Edit ${student.firstName} ${student.lastName}`} onClick={() => openEditDialog(student)} sx={{ color: brand.muted }}>
                  <EditIcon fontSize="small" />
                </IconButton>
                <IconButton aria-label={`Deactivate ${student.firstName} ${student.lastName}`} onClick={() => handleDelete(student.id)} sx={{ color: brand.muted }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Box>
            ))}
          </Box>
        ) : (
          <TableContainer>
          <Table sx={{ minWidth: 650, '& th': { color: brand.muted, fontWeight: 600, fontSize: '13px' } }}>
            <TableHead>
              <TableRow>
                <TableCell>Admission #</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Gender</TableCell>
                <TableCell>Date of Birth</TableCell>
                <TableCell>Class</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {shown.map((student) => (
                <TableRow key={student.id} hover>
                  <TableCell sx={{ color: brand.muted }}>{student.admissionNumber}</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>
                    {student.firstName} {student.lastName}
                  </TableCell>
                  <TableCell>{titleCase(student.gender)}</TableCell>
                  <TableCell>{formatDate(student.dateOfBirth)}</TableCell>
                  <TableCell>{classLabel(student)}</TableCell>
                  <TableCell>
                    <StatusBadge status={student.status} />
                  </TableCell>
                  <TableCell align="right">
                    {canManageParents && (
                      <Tooltip title="Parent access">
                        <IconButton size="small" aria-label={`Parent access for ${student.firstName} ${student.lastName}`} onClick={() => setParentFor(student)}>
                          <ParentIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Edit">
                      <IconButton size="small" aria-label={`Edit ${student.firstName} ${student.lastName}`} onClick={() => openEditDialog(student)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Deactivate">
                      <IconButton size="small" aria-label={`Deactivate ${student.firstName} ${student.lastName}`} onClick={() => handleDelete(student.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Student' : 'Add Student'}</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {formError}
            </Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="First Name"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              required
              margin="dense"
            />
            <TextField
              fullWidth
              label="Last Name"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              required
              margin="dense"
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              fullWidth
              label="Date of Birth"
              type="date"
              value={form.dateOfBirth}
              onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })}
              required
              margin="dense"
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              fullWidth
              select
              label="Gender"
              value={form.gender}
              onChange={(e) => setForm({ ...form, gender: e.target.value })}
              margin="dense"
            >
              <MenuItem value="MALE">Male</MenuItem>
              <MenuItem value="FEMALE">Female</MenuItem>
              <MenuItem value="OTHER">Other</MenuItem>
            </TextField>
          </Stack>
          <TextField
            fullWidth
            label="Admission Number"
            value={form.admissionNumber}
            onChange={(e) => setForm({ ...form, admissionNumber: e.target.value })}
            required
            margin="dense"
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              fullWidth
              select
              label="Class"
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              margin="dense"
              helperText={activeClasses.length === 0 ? 'Create classes on the Classes page first' : undefined}
            >
              <MenuItem value="">No class yet</MenuItem>
              {activeClasses.map((c) => (
                <MenuItem key={c.id} value={c.id}>{labels.get(c.id) ?? c.name}</MenuItem>
              ))}
              {/* Keep a student's current class selectable even if it was deleted or can't be found */}
              {form.classId && !activeClasses.some((c) => c.id === form.classId) && (
                <MenuItem value={form.classId}>{classNameById.get(form.classId) ?? 'Unknown class'}</MenuItem>
              )}
            </TextField>
            <TextField
              fullWidth
              label="Section"
              value={form.section}
              onChange={(e) => setForm({ ...form, section: e.target.value })}
              margin="dense"
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              fullWidth
              label="Parent Email"
              type="email"
              value={form.parentEmail}
              onChange={(e) => setForm({ ...form, parentEmail: e.target.value })}
              margin="dense"
            />
            <TextField
              fullWidth
              label="Parent Phone"
              value={form.parentPhone}
              onChange={(e) => setForm({ ...form, parentPhone: e.target.value })}
              margin="dense"
            />
          </Stack>
          <TextField
            fullWidth
            label="Address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.firstName || !form.lastName || !form.dateOfBirth || !form.admissionNumber}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => fetchStudents(search)}
        title="Import Students"
        endpoint="/students/bulk-import"
        columns={studentColumns}
      />

      {parentFor && <ParentAccessDialog student={parentFor} onClose={() => setParentFor(null)} />}
    </Box>
  )
}
