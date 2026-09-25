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
  CheckCircle as PresentIcon,
  Cancel as AbsentIcon,
  Schedule as LateIcon,
} from '@mui/icons-material'
import PageHeader from '../components/PageHeader'
import ResponsiveTable from '../components/ResponsiveTable'
import ResponsiveDialog from '../components/ResponsiveDialog'
import type { Attendance } from '@shared-types/index'
import {
  listAttendance,
  createAttendance,
  updateAttendance,
  deleteAttendance,
} from '../lib/attendanceApi'

const STATUS_OPTIONS = ['PRESENT', 'ABSENT', 'LATE'] as const

const emptyForm = {
  studentId: '',
  classId: '',
  subjectId: '',
  date: '',
  status: 'PRESENT' as (typeof STATUS_OPTIONS)[number],
}

const statusColor = (status: string) => {
  if (status === 'PRESENT') return 'success'
  if (status === 'LATE') return 'warning'
  return 'error'
}

export default function AttendancePage() {
  const [records, setRecords] = useState<Attendance[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchRecords = async (searchTerm?: string) => {
    setLoading(true)
    setError('')
    try {
      const data = await listAttendance(searchTerm ? { studentId: searchTerm } : undefined)
      setRecords(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load attendance records')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecords()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => fetchRecords(search), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const openCreateDialog = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setDialogOpen(true)
  }

  const openEditDialog = (record: Attendance) => {
    setEditingId(record.id)
    setForm({
      studentId: record.studentId,
      classId: record.classId,
      subjectId: record.subjectId,
      date: record.date,
      status: record.status,
    })
    setFormError('')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setFormError('')
    try {
      if (editingId) {
        await updateAttendance(editingId, form)
      } else {
        await createAttendance(form)
      }
      setDialogOpen(false)
      fetchRecords(search)
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save attendance record')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this attendance record?')) return
    try {
      await deleteAttendance(id)
      fetchRecords(search)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete attendance record')
    }
  }

  const handleStatusUpdate = async (id: string, status: (typeof STATUS_OPTIONS)[number]) => {
    try {
      await updateAttendance(id, { status })
      fetchRecords(search)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update status')
    }
  }

  return (
    <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3 } }}>
      <PageHeader title="Attendance">
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Record
        </Button>
      </PageHeader>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search by student ID"
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
                <TableCell>Student ID</TableCell>
                <TableCell>Class ID</TableCell>
                <TableCell>Subject ID</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {records.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No attendance records found
                  </TableCell>
                </TableRow>
              )}
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{record.studentId}</TableCell>
                  <TableCell>{record.classId}</TableCell>
                  <TableCell>{record.subjectId}</TableCell>
                  <TableCell>{record.date}</TableCell>
                  <TableCell>
                    <Chip label={record.status} color={statusColor(record.status) as any} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Mark Present">
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => handleStatusUpdate(record.id, 'PRESENT')}
                      >
                        <PresentIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Mark Late">
                      <IconButton
                        size="small"
                        color="warning"
                        onClick={() => handleStatusUpdate(record.id, 'LATE')}
                      >
                        <LateIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Mark Absent">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleStatusUpdate(record.id, 'ABSENT')}
                      >
                        <AbsentIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditDialog(record)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDelete(record.id)}>
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
        <DialogTitle>{editingId ? 'Edit Attendance Record' : 'Add Attendance Record'}</DialogTitle>
        <DialogContent>
          {formError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {formError}
            </Alert>
          )}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
            <TextField
              fullWidth
              label="Student ID"
              value={form.studentId}
              onChange={(e) => setForm({ ...form, studentId: e.target.value })}
              required
              margin="dense"
            />
            <TextField
              fullWidth
              label="Class ID"
              value={form.classId}
              onChange={(e) => setForm({ ...form, classId: e.target.value })}
              required
              margin="dense"
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              fullWidth
              label="Subject ID"
              value={form.subjectId}
              onChange={(e) => setForm({ ...form, subjectId: e.target.value })}
              required
              margin="dense"
            />
            <TextField
              fullWidth
              label="Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
              margin="dense"
            />
          </Stack>
          <TextField
            select
            fullWidth
            label="Status"
            value={form.status}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as (typeof STATUS_OPTIONS)[number] })
            }
            margin="dense"
          >
            {STATUS_OPTIONS.map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.studentId || !form.classId || !form.subjectId || !form.date}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>
    </Box>
  )
}
