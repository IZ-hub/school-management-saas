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
import type { Class } from '@shared-types/index'
import { listClasses, createClass, updateClass, deleteClass } from '../lib/classesApi'
import BulkImportDialog, { ColumnDef } from '../components/BulkImportDialog'

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
      const data = await listClasses(searchTerm ? { name: searchTerm } : undefined)
      setClasses(data)
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

  const handleDelete = async (id: string) => {
    if (!window.confirm('Deactivate this class?')) return
    try {
      await deleteClass(id)
      fetchClasses(search)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete class')
    }
  }

  return (
    <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3 } }}>
      <PageHeader title="Classes">
        <Button variant="outlined" startIcon={<ImportIcon />} onClick={() => setImportOpen(true)}
          sx={{ borderColor: '#111', color: '#111', '&:hover': { borderColor: '#333', bgcolor: '#f5f5f5' } }}>
          Import CSV
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Class
        </Button>
      </PageHeader>

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
                <TableCell>Grade Level</TableCell>
                <TableCell>Capacity</TableCell>
                <TableCell>Students</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {classes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No classes found
                  </TableCell>
                </TableRow>
              )}
              {classes.map((schoolClass) => (
                <TableRow key={schoolClass.id}>
                  <TableCell>{schoolClass.name}</TableCell>
                  <TableCell>{schoolClass.gradeLevel}</TableCell>
                  <TableCell>{schoolClass.capacity ?? '-'}</TableCell>
                  <TableCell>{schoolClass.studentIds.length}</TableCell>
                  <TableCell>
                    <Chip
                      label={schoolClass.status}
                      color={schoolClass.status === 'ACTIVE' ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditDialog(schoolClass)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Deactivate">
                      <IconButton size="small" onClick={() => handleDelete(schoolClass.id)}>
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
      </ResponsiveDialog>

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
