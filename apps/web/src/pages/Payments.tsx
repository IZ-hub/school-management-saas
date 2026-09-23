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
  Chip,
  Dialog,
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
} from '@mui/icons-material'
import type { Payment } from '@shared-types/index'
import { listPayments, createPayment, updatePayment, deletePayment } from '../lib/paymentsApi'

const METHOD_OPTIONS = ['CASH', 'CARD', 'TRANSFER'] as const

const emptyForm = {
  feeId: '',
  studentId: '',
  amountPaid: '',
  method: 'CASH' as (typeof METHOD_OPTIONS)[number],
  reference: '',
}

const methodColor = (method: string) => {
  if (method === 'CASH') return 'success'
  if (method === 'CARD') return 'info'
  return 'default'
}

export default function Payments() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchPayments = async (searchTerm?: string) => {
    setLoading(true)
    setError('')
    try {
      const data = await listPayments(searchTerm ? { studentId: searchTerm } : undefined)
      setPayments(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load payments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPayments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => fetchPayments(search), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const openCreateDialog = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setDialogOpen(true)
  }

  const openEditDialog = (payment: Payment) => {
    setEditingId(payment.id)
    setForm({
      feeId: payment.feeId,
      studentId: payment.studentId,
      amountPaid: String(payment.amountPaid),
      method: payment.method,
      reference: payment.reference || '',
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
        amountPaid: Number(form.amountPaid),
        reference: form.reference || undefined,
      }
      if (editingId) {
        await updatePayment(editingId, payload)
      } else {
        await createPayment(payload)
      }
      setDialogOpen(false)
      fetchPayments(search)
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save payment')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this payment?')) return
    try {
      await deletePayment(id)
      fetchPayments(search)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete payment')
    }
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          Payments
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Payment
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
                <TableCell>Fee ID</TableCell>
                <TableCell>Amount Paid</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Reference</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No payments found
                  </TableCell>
                </TableRow>
              )}
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>{payment.studentId}</TableCell>
                  <TableCell>{payment.feeId}</TableCell>
                  <TableCell>{payment.amountPaid}</TableCell>
                  <TableCell>
                    <Chip label={payment.method} color={methodColor(payment.method) as any} size="small" />
                  </TableCell>
                  <TableCell>{payment.reference ?? '-'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditDialog(payment)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDelete(payment.id)}>
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
        <DialogTitle>{editingId ? 'Edit Payment' : 'Add Payment'}</DialogTitle>
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
              label="Fee ID"
              value={form.feeId}
              onChange={(e) => setForm({ ...form, feeId: e.target.value })}
              required
              margin="dense"
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              fullWidth
              label="Amount Paid"
              type="number"
              value={form.amountPaid}
              onChange={(e) => setForm({ ...form, amountPaid: e.target.value })}
              required
              margin="dense"
            />
            <TextField
              select
              fullWidth
              label="Method"
              value={form.method}
              onChange={(e) =>
                setForm({ ...form, method: e.target.value as (typeof METHOD_OPTIONS)[number] })
              }
              margin="dense"
            >
              {METHOD_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
          <TextField
            fullWidth
            label="Reference"
            value={form.reference}
            onChange={(e) => setForm({ ...form, reference: e.target.value })}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.studentId || !form.feeId || !form.amountPaid}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
