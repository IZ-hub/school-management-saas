import { useEffect, useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
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
} from '@mui/material'
import {
  Add as AddIcon,
  Search as SearchIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import type { Result } from '@shared-types/index'
import { listResults, createResult, updateResult, deleteResult } from '../lib/resultsApi'

const emptyForm = {
  examId: '',
  studentId: '',
  score: '',
  grade: '',
  remarks: '',
}

export default function Results() {
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchResults = async (searchTerm?: string) => {
    setLoading(true)
    setError('')
    try {
      const data = await listResults(searchTerm ? { studentId: searchTerm } : undefined)
      setResults(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load results')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResults()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => fetchResults(search), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const openCreateDialog = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setDialogOpen(true)
  }

  const openEditDialog = (result: Result) => {
    setEditingId(result.id)
    setForm({
      examId: result.examId,
      studentId: result.studentId,
      score: String(result.score),
      grade: result.grade || '',
      remarks: result.remarks || '',
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
        score: Number(form.score),
        grade: form.grade || undefined,
        remarks: form.remarks || undefined,
      }
      if (editingId) {
        await updateResult(editingId, payload)
      } else {
        await createResult(payload)
      }
      setDialogOpen(false)
      fetchResults(search)
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save result')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this result?')) return
    try {
      await deleteResult(id)
      fetchResults(search)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete result')
    }
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Results
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Result
        </Button>
      </Stack>

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
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Student ID</TableCell>
                <TableCell>Exam ID</TableCell>
                <TableCell>Score</TableCell>
                <TableCell>Grade</TableCell>
                <TableCell>Remarks</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No results found
                  </TableCell>
                </TableRow>
              )}
              {results.map((result) => (
                <TableRow key={result.id}>
                  <TableCell>{result.studentId}</TableCell>
                  <TableCell>{result.examId}</TableCell>
                  <TableCell>{result.score}</TableCell>
                  <TableCell>{result.grade ?? '-'}</TableCell>
                  <TableCell>{result.remarks ?? '-'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditDialog(result)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDelete(result.id)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingId ? 'Edit Result' : 'Add Result'}</DialogTitle>
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
              label="Exam ID"
              value={form.examId}
              onChange={(e) => setForm({ ...form, examId: e.target.value })}
              required
              margin="dense"
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              fullWidth
              label="Score"
              type="number"
              value={form.score}
              onChange={(e) => setForm({ ...form, score: e.target.value })}
              required
              margin="dense"
            />
            <TextField
              fullWidth
              label="Grade"
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: e.target.value })}
              margin="dense"
            />
          </Stack>
          <TextField
            fullWidth
            label="Remarks"
            value={form.remarks}
            onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            margin="dense"
            multiline
            rows={2}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.studentId || !form.examId || !form.score}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
