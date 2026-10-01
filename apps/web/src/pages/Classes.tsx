import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  Alert,
  Stack,
  Tooltip,
  CircularProgress,
  FormControlLabel,
  Snackbar,
  Switch,
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileUpload as ImportIcon,
} from '@mui/icons-material'
import type { Class } from '@shared-types/index'
import { listClasses, createClass, updateClass, deleteClass } from '../lib/classesApi'
import BulkImportDialog, { ColumnDef } from '../components/BulkImportDialog'
import { api } from '../lib/api'
import { classLabels, duplicateClassGroups } from '../lib/classLabels'
import { brand } from '../theme'

const emptyForm = {
  name: '',
  gradeLevel: '',
  teacherId: '',
  capacity: '',
}

export default function Classes() {
  const [classes, setClasses] = useState<Class[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [importOpen, setImportOpen] = useState(false)
  const [studentCounts, setStudentCounts] = useState<Map<string, number>>(new Map())
  const [subjectCounts, setSubjectCounts] = useState<Map<string, number>>(new Map())
  const [showDeleted, setShowDeleted] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Class | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [notice, setNotice] = useState('')
  const navigate = useNavigate()

  const labels = useMemo(() => classLabels(classes), [classes])
  const duplicates = useMemo(() => duplicateClassGroups(classes), [classes])
  const deletedCount = classes.filter((c) => c.status === 'INACTIVE').length
  const visibleClasses = classes
    .filter((c) => showDeleted || c.status !== 'INACTIVE')
    .sort((a, b) => (labels.get(a.id) ?? a.name).localeCompare(labels.get(b.id) ?? b.name, undefined, { numeric: true }))
  const countFor = (id: string) => studentCounts.get(id) ?? 0

  const classColumns: ColumnDef[] = [
    { key: 'name', label: 'Class Name', required: true },
    { key: 'gradeLevel', label: 'Grade Level', required: true },
    { key: 'teacherId', label: 'Teacher ID' },
    { key: 'capacity', label: 'Capacity' },
  ]

  const fetchClasses = async (searchTerm?: string) => {
    setLoading(true)
    setError('')
    try {
      const [data, studentsRes, assignmentsRes] = await Promise.all([
        listClasses(searchTerm ? { name: searchTerm } : undefined),
        api.get('/students'),
        api.get('/teaching-assignments'),
      ])
      const perClass = new Map<string, number>()
      for (const a of assignmentsRes.data.data as { classId: string }[]) perClass.set(a.classId, (perClass.get(a.classId) ?? 0) + 1)
      setSubjectCounts(perClass)
      setClasses(data)
      // Count active students per class from the students themselves (the class's own list isn't kept up to date).
      const counts = new Map<string, number>()
      for (const st of studentsRes.data.data as { classId?: string | null; status?: string }[]) {
        if (st.classId && st.status !== 'INACTIVE') counts.set(st.classId, (counts.get(st.classId) ?? 0) + 1)
      }
      setStudentCounts(counts)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load classes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClasses()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => fetchClasses(search), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const openCreateDialog = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setDialogOpen(true)
  }

  const openEditDialog = (schoolClass: Class) => {
    setEditingId(schoolClass.id)
    setForm({
      name: schoolClass.name,
      gradeLevel: schoolClass.gradeLevel,
      teacherId: schoolClass.teacherId || '',
      capacity: schoolClass.capacity != null ? String(schoolClass.capacity) : '',
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
        teacherId: form.teacherId || undefined,
        capacity: form.capacity ? Number(form.capacity) : undefined,
      }
      if (editingId) {
        await updateClass(editingId, payload)
      } else {
        await createClass(payload)
      }
      setDialogOpen(false)
      fetchClasses(search)
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save class')
    } finally {
      setSaving(false)
    }
  }

  const openDelete = (schoolClass: Class) => {
    setDeleteError('')
    setDeleteTarget(schoolClass)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteClass(deleteTarget.id)
      setNotice(`${labels.get(deleteTarget.id) ?? deleteTarget.name} deleted`)
      setDeleteTarget(null)
      fetchClasses(search)
    } catch (err: any) {
      setDeleteError(err.response?.data?.message || 'Failed to delete class')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Classes
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<ImportIcon />} onClick={() => setImportOpen(true)} size="small"
            sx={{ borderColor: brand.border, color: brand.text, bgcolor: brand.surface, '&:hover': { borderColor: '#d6d3c9', bgcolor: brand.surface }, whiteSpace: 'nowrap' }}>
            Import CSV
          </Button>
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog} size="small" sx={{ whiteSpace: 'nowrap' }}>
            Add Class
          </Button>
        </Stack>
      </Stack>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search by name"
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

      {duplicates.length > 0 && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <strong>
            Some classes share a name:{' '}
            {duplicates.map((g) => `${g[0].name} (${g.length} copies)`).join(' and ')}.
          </strong>{' '}
          Keep one copy of each. Move students out of the extra copy (click its student count), then delete it.
        </Alert>
      )}

      {deletedCount > 0 && (
        <FormControlLabel
          sx={{ mb: 1, ml: 0.25, '& .MuiFormControlLabel-label': { fontSize: '14px', color: brand.muted } }}
          control={<Switch size="small" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />}
          label={`Show deleted classes (${deletedCount})`}
        />
      )}

      <Paper>
        {error && (
          <Alert severity="error" sx={{ m: 2 }}>
            {error}
          </Alert>
        )}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
          <Table sx={{ minWidth: 600 }}>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Grade Level</TableCell>
                <TableCell>Capacity</TableCell>
                <TableCell>Students</TableCell>
                <TableCell>Subjects</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleClasses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No classes found
                  </TableCell>
                </TableRow>
              )}
              {visibleClasses.map((schoolClass) => {
                const deleted = schoolClass.status === 'INACTIVE'
                const isCopy = (labels.get(schoolClass.id) ?? '') !== schoolClass.name
                const count = countFor(schoolClass.id)
                return (
                  <TableRow key={schoolClass.id} sx={{ opacity: deleted ? 0.55 : 1 }}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {labels.get(schoolClass.id) ?? schoolClass.name}
                      {isCopy && (
                        <Box component="span" sx={{ ml: 1, px: 0.75, py: 0.1, borderRadius: 999, fontSize: '11px', fontWeight: 600, bgcolor: '#fff4e5', color: '#8a4b00' }}>
                          Duplicate
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>{schoolClass.gradeLevel}</TableCell>
                    <TableCell>{schoolClass.capacity ?? '-'}</TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => navigate(`/students?class=${schoolClass.id}`)}
                        sx={{ minWidth: 0, px: 1, fontWeight: 600, color: count ? brand.green : brand.subtle }}
                        aria-label={`View the ${count} students in ${labels.get(schoolClass.id) ?? schoolClass.name}`}>
                        {count}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Button size="small" onClick={() => navigate(`/class-subjects?class=${schoolClass.id}`)}
                        sx={{ minWidth: 0, px: 1, fontWeight: 600, color: subjectCounts.get(schoolClass.id) ? brand.green : brand.subtle }}
                        aria-label={`View the subjects ${labels.get(schoolClass.id) ?? schoolClass.name} takes`}>
                        {subjectCounts.get(schoolClass.id) ?? 0}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 999, fontSize: '12px', fontWeight: 600,
                        bgcolor: deleted ? '#f1f0ec' : brand.greenSoft, color: deleted ? brand.muted : brand.green }}>
                        {deleted ? 'Deleted' : 'Active'}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      {!deleted && (
                        <>
                          <Tooltip title="Edit">
                            <IconButton size="small" aria-label={`Edit ${labels.get(schoolClass.id)}`} onClick={() => openEditDialog(schoolClass)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete">
                            <IconButton size="small" aria-label={`Delete ${labels.get(schoolClass.id)}`} onClick={() => openDelete(schoolClass)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Class' : 'Add Class'}</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {formError}
            </Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              margin="dense"
            />
            <TextField
              fullWidth
              label="Grade Level"
              value={form.gradeLevel}
              onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })}
              required
              margin="dense"
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              fullWidth
              label="Capacity"
              type="number"
              value={form.capacity}
              onChange={(e) => setForm({ ...form, capacity: e.target.value })}
              margin="dense"
            />
            <TextField
              fullWidth
              label="Teacher ID"
              value={form.teacherId}
              onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
              margin="dense"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.name || !form.gradeLevel}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteTarget} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        {deleteTarget && (() => {
          const name = labels.get(deleteTarget.id) ?? deleteTarget.name
          const count = countFor(deleteTarget.id)
          return (
            <>
              <DialogTitle sx={{ fontWeight: 700 }}>{count > 0 ? `${name} still has students` : `Delete ${name}?`}</DialogTitle>
              <DialogContent>
                {count > 0 ? (
                  <Typography variant="body2" sx={{ color: brand.muted }}>
                    {count} {count === 1 ? 'student is' : 'students are'} in {name}. Move them to another class
                    first (open each student and change their Class), then delete this class.
                  </Typography>
                ) : (
                  <Typography variant="body2" sx={{ color: brand.muted }}>
                    {name} will be removed from your class list and from class dropdowns. It has no students.
                  </Typography>
                )}
                {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
              </DialogContent>
              <DialogActions sx={{ px: 3, pb: 2 }}>
                <Button onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
                {count > 0 ? (
                  <Button variant="contained" onClick={() => navigate(`/students?class=${deleteTarget.id}`)}>
                    View its students
                  </Button>
                ) : (
                  <Button variant="contained" color="error" onClick={confirmDelete} disabled={deleting}>
                    {deleting ? 'Deleting…' : 'Delete class'}
                  </Button>
                )}
              </DialogActions>
            </>
          )
        })()}
      </Dialog>

      <Snackbar open={!!notice} autoHideDuration={3000} onClose={() => setNotice('')} message={notice} />

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => fetchClasses(search)}
        title="Import Classes"
        endpoint="/classes/bulk-import"
        columns={classColumns}
      />
    </Box>
  )
}
