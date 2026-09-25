import { useEffect, useState } from 'react'
import {
  Box,
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
import type { Subject } from '@shared-types/index'
import { listSubjects, createSubject, updateSubject, deleteSubject } from '../lib/subjectsApi'
import BulkImportDialog, { ColumnDef } from '../components/BulkImportDialog'

const emptyForm = {
  name: '',
  code: '',
  teacherId: '',
}

export default function Subjects() {
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [importOpen, setImportOpen] = useState(false)

  const subjectColumns: ColumnDef[] = [
    { key: 'name', label: 'Subject Name', required: true },
    { key: 'code', label: 'Subject Code', required: true },
    { key: 'teacherId', label: 'Teacher ID' },
  ]

  const fetchSubjects = async (searchTerm?: string) => {
    setLoading(true)
    setError('')
    try {
      const data = await listSubjects(searchTerm ? { name: searchTerm } : undefined)
      setSubjects(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load subjects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSubjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => fetchSubjects(search), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const openCreateDialog = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setDialogOpen(true)
  }

  const openEditDialog = (subject: Subject) => {
    setEditingId(subject.id)
    setForm({
      name: subject.name,
      code: subject.code,
      teacherId: subject.teacherId || '',
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
      }
      if (editingId) {
        await updateSubject(editingId, payload)
      } else {
        await createSubject(payload)
      }
      setDialogOpen(false)
      fetchSubjects(search)
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save subject')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deactivate this subject?')) return
    try {
      await deleteSubject(id)
      fetchSubjects(search)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete subject')
    }
  }

  return (
    <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3 } }}>
      <PageHeader title="Subjects">
        <Button variant="outlined" startIcon={<ImportIcon />} onClick={() => setImportOpen(true)}
          sx={{ borderColor: '#111', color: '#111', '&:hover': { borderColor: '#333', bgcolor: '#f5f5f5' } }}>
          Import CSV
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Subject
        </Button>
      </PageHeader>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search by name or code"
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
          <ResponsiveTable>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Code</TableCell>
                <TableCell>Teacher ID</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {subjects.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No subjects found
                  </TableCell>
                </TableRow>
              )}
              {subjects.map((subject) => (
                <TableRow key={subject.id}>
                  <TableCell>{subject.name}</TableCell>
                  <TableCell>{subject.code}</TableCell>
                  <TableCell>{subject.teacherId ?? '-'}</TableCell>
                  <TableCell>
                    <Chip
                      label={subject.status}
                      color={subject.status === 'ACTIVE' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditDialog(subject)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Deactivate">
                      <IconButton size="small" onClick={() => handleDelete(subject.id)}>
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
        <DialogTitle>{editingId ? 'Edit Subject' : 'Add Subject'}</DialogTitle>
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
              label="Code"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              required
              margin="dense"
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
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
            disabled={saving || !form.name || !form.code}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={() => fetchSubjects(search)}
        title="Import Subjects"
        endpoint="/subjects/bulk-import"
        columns={subjectColumns}
      />
    </Box>
  )
}
