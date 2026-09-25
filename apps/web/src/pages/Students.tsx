import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  Alert,
  Stack,
  Tooltip,
  CircularProgress,
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  FileUpload as ImportIcon,
} from '@mui/icons-material'
import PageHeader from '../components/PageHeader'
import ResponsiveTable from '../components/ResponsiveTable'
import ResponsiveDialog from '../components/ResponsiveDialog'
import { api } from '../lib/api'
import BulkImportDialog, { ColumnDef } from '../components/BulkImportDialog'

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

  const studentColumns: ColumnDef[] = [
    { key: 'firstName', label: 'First Name', required: true },
    { key: 'lastName', label: 'Last Name', required: true },
    { key: 'admissionNumber', label: 'Admission Number', required: true },
    { key: 'dateOfBirth', label: 'Date of Birth' },
    { key: 'gender', label: 'Gender' },
    { key: 'classId', label: 'Class ID' },
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
    <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3 } }}>
      <PageHeader title="Students">
        <Button variant="outlined" startIcon={<ImportIcon />} onClick={() => setImportOpen(true)}
          sx={{ borderColor: '#111', color: '#111', '&:hover': { borderColor: '#333', bgcolor: '#f5f5f5' } }}>
          Import CSV
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Student
        </Button>
      </PageHeader>

      <Paper sx={{ p: 2, mb: 2 }}>
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

      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : students.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">No students found.</Typography>
          </Box>
        ) : (
          <ResponsiveTable>
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
              {students.map((student) => (
                <TableRow key={student.id} hover>
                  <TableCell>{student.admissionNumber}</TableCell>
                  <TableCell>
                    {student.firstName} {student.lastName}
                  </TableCell>
                  <TableCell>{student.gender}</TableCell>
                  <TableCell>{student.dateOfBirth}</TableCell>
                  <TableCell>
                    {student.classId ? `${student.classId}${student.section ? ' - ' + student.section : ''}` : '—'}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={student.status}
                      size="small"
                      color={student.status === 'ACTIVE' ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditDialog(student)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Deactivate">
                      <IconButton size="small" onClick={() => handleDelete(student.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ResponsiveTable>
        )}
      </Paper>

      <ResponsiveDialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
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
              label="Class ID"
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              margin="dense"
            />
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
      </ResponsiveDialog>

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => fetchStudents(search)}
        title="Import Students"
        endpoint="/students/bulk-import"
        columns={studentColumns}
      />
    </Box>
  )
}
