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
  Payment as PaymentIcon,
} from '@mui/icons-material'
import PageHeader from '../components/PageHeader'
import ResponsiveTable from '../components/ResponsiveTable'
import ResponsiveDialog from '../components/ResponsiveDialog'
import type { Fee } from '@shared-types/index'
import { listFees, createFee, updateFee, deleteFee } from '../lib/feesApi'
import { createPayment } from '../lib/paymentsApi'

const STATUS_OPTIONS = ['PENDING', 'PAID', 'OVERDUE'] as const

const emptyForm = {
  studentId: '',
  classId: '',
  term: '',
  amount: '',
  dueDate: '',
  status: 'PENDING' as (typeof STATUS_OPTIONS)[number],
}

const emptyPaymentForm = {
  amountPaid: '',
  method: 'CASH' as 'CASH' | 'CARD' | 'TRANSFER',
  reference: '',
}

const statusColor = (status: string) => {
  if (status === 'PAID') return 'success'
  if (status === 'OVERDUE') return 'error'
  return 'warning'
}

export default function Fees() {
  const [fees, setFees] = useState<Fee[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false)
  const [payingFeeId, setPayingFeeId] = useState<string | null>(null)
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm)
  const [payingSaving, setPayingSaving] = useState(false)
  const [paymentError, setPaymentError] = useState('')

  const fetchFees = async (searchTerm?: string) => {
    setLoading(true)
    setError('')
    try {
      const data = await listFees(searchTerm ? { studentId: searchTerm } : undefined)
      setFees(data)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load fees')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchFees()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timeout = setTimeout(() => fetchFees(search), 400)
    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  const openCreateDialog = () => {
    setEditingId(null)
    setForm(emptyForm)
    setFormError('')
    setDialogOpen(true)
  }

  const openEditDialog = (fee: Fee) => {
    setEditingId(fee.id)
    setForm({
      studentId: fee.studentId,
      classId: fee.classId,
      term: fee.term,
      amount: String(fee.amount),
      dueDate: fee.dueDate,
      status: fee.status,
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
        amount: Number(form.amount),
      }
      if (editingId) {
        await updateFee(editingId, payload)
      } else {
        await createFee(payload)
      }
      setDialogOpen(false)
      fetchFees(search)
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save fee')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this fee?')) return
    try {
      await deleteFee(id)
      fetchFees(search)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to delete fee')
    }
  }

  const openPaymentDialog = (fee: Fee) => {
    setPayingFeeId(fee.id)
    setPaymentForm(emptyPaymentForm)
    setPaymentError('')
    setPaymentDialogOpen(true)
  }

  const handleRecordPayment = async () => {
    if (!payingFeeId) return
    const fee = fees.find((f) => f.id === payingFeeId)
    if (!fee) return

    setPayingSaving(true)
    setPaymentError('')
    try {
      await createPayment({
        feeId: payingFeeId,
        studentId: fee.studentId,
        amountPaid: Number(paymentForm.amountPaid),
        method: paymentForm.method,
        reference: paymentForm.reference || undefined,
      })
      setPaymentDialogOpen(false)
      fetchFees(search)
    } catch (err: any) {
      setPaymentError(err.response?.data?.message || 'Failed to record payment')
    } finally {
      setPayingSaving(false)
    }
  }

  return (
    <Box sx={{ flexGrow: 1, p: { xs: 2, sm: 3 } }}>
      <PageHeader title="Fees">
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Fee
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
                <TableCell>Term</TableCell>
                <TableCell>Amount</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {fees.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    No fees found
                  </TableCell>
                </TableRow>
              )}
              {fees.map((fee) => (
                <TableRow key={fee.id}>
                  <TableCell>{fee.studentId}</TableCell>
                  <TableCell>{fee.classId}</TableCell>
                  <TableCell>{fee.term}</TableCell>
                  <TableCell>{fee.amount}</TableCell>
                  <TableCell>{fee.dueDate}</TableCell>
                  <TableCell>
                    <Chip label={fee.status} color={statusColor(fee.status) as any} size="small" />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Record Payment">
                      <IconButton
                        size="small"
                        color="success"
                        onClick={() => openPaymentDialog(fee)}
                        disabled={fee.status === 'PAID'}
                      >
                        <PaymentIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => openEditDialog(fee)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDelete(fee.id)}>
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
        <DialogTitle>{editingId ? 'Edit Fee' : 'Add Fee'}</DialogTitle>
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
              label="Term"
              value={form.term}
              onChange={(e) => setForm({ ...form, term: e.target.value })}
              required
              margin="dense"
            />
            <TextField
              fullWidth
              label="Amount"
              type="number"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
              margin="dense"
            />
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <TextField
              fullWidth
              label="Due Date"
              type="date"
              InputLabelProps={{ shrink: true }}
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
              required
              margin="dense"
            />
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
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.studentId || !form.classId || !form.term || !form.amount || !form.dueDate}
          >
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>

      <ResponsiveDialog open={paymentDialogOpen} onClose={() => setPaymentDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Record Payment</DialogTitle>
        <DialogContent>
          {paymentError && (
            <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
              {paymentError}
            </Alert>
          )}
          <TextField
            fullWidth
            label="Amount Paid"
            type="number"
            value={paymentForm.amountPaid}
            onChange={(e) => setPaymentForm({ ...paymentForm, amountPaid: e.target.value })}
            required
            margin="dense"
          />
          <TextField
            select
            fullWidth
            label="Method"
            value={paymentForm.method}
            onChange={(e) =>
              setPaymentForm({ ...paymentForm, method: e.target.value as 'CASH' | 'CARD' | 'TRANSFER' })
            }
            margin="dense"
          >
            {(['CASH', 'CARD', 'TRANSFER'] as const).map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            fullWidth
            label="Reference"
            value={paymentForm.reference}
            onChange={(e) => setPaymentForm({ ...paymentForm, reference: e.target.value })}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleRecordPayment}
            disabled={payingSaving || !paymentForm.amountPaid}
          >
            {payingSaving ? 'Saving...' : 'Record Payment'}
          </Button>
        </DialogActions>
      </ResponsiveDialog>
    </Box>
  )
}
