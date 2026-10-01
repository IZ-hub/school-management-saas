import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
  Stack,
  Switch,
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
import {
  Add as AddIcon,
  ArchiveOutlined as ArchiveIcon,
  Edit as EditIcon,
  FileUpload as ImportIcon,
  Search as SearchIcon,
  UnarchiveOutlined as RestoreIcon,
} from '@mui/icons-material'
import type { Subject } from '@shared-types/index'
import { listSubjects, createSubject, updateSubject, deleteSubject } from '../lib/subjectsApi'
import { api } from '../lib/api'
import BulkImportDialog, { ColumnDef } from '../components/BulkImportDialog'
import { useAuthStore } from '../store/authStore'
import { brand } from '../theme'

const ADMIN_ROLES = ['SUPER_ADMIN', 'SCHOOL_OWNER', 'PRINCIPAL', 'VICE_PRINCIPAL']

const subjectColumns: ColumnDef[] = [
  { key: 'name', label: 'Subject Name', required: true },
  { key: 'code', label: 'Subject Code', required: true },
]

function StatusBadge({ archived }: { archived: boolean }) {
  return (
    <Box component="span" sx={{ px: 1, py: 0.25, borderRadius: 999, fontSize: '12px', fontWeight: 600,
      bgcolor: archived ? '#f1f0ec' : brand.greenSoft, color: archived ? brand.muted : brand.green }}>
      {archived ? 'Archived' : 'Active'}
    </Box>
  )
}

export default function Subjects() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isPhone = useMediaQuery(theme.breakpoints.down('sm'))
  const canEdit = ADMIN_ROLES.includes(useAuthStore((s) => s.user?.role) ?? '')

  const [subjects, setSubjects] = useState<Subject[]>([])
  const [classCounts, setClassCounts] = useState<Map<string, number>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Subject | null>(null)
  const [form, setForm] = useState({ name: '', code: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const [archiveTarget, setArchiveTarget] = useState<Subject | null>(null)
  const [busy, setBusy] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [notice, setNotice] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    setError('')
    try {
      const [subjectList, assignments] = await Promise.all([listSubjects(), api.get('/teaching-assignments')])
      setSubjects(subjectList)
      const counts = new Map<string, number>()
      for (const a of assignments.data.data as { subjectId: string }[]) counts.set(a.subjectId, (counts.get(a.subjectId) ?? 0) + 1)
      setClassCounts(counts)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to load subjects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAll()
  }, [])

  const archivedCount = subjects.filter((s) => s.status === 'INACTIVE').length
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return subjects
      .filter((s) => showArchived || s.status !== 'INACTIVE')
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
  }, [subjects, search, showArchived])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', code: '' })
    setFormError('')
    setDialogOpen(true)
  }

  const openEdit = (subject: Subject) => {
    setEditing(subject)
    setForm({ name: subject.name, code: subject.code })
    setFormError('')
    setDialogOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setFormError('')
    try {
      const payload = { name: form.name.trim(), code: form.code.trim() }
      if (editing) await updateSubject(editing.id, payload)
      else await createSubject(payload)
      setDialogOpen(false)
      setNotice(editing ? `${payload.name} updated` : `${payload.name} added`)
      fetchAll()
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Failed to save subject')
    } finally {
      setSaving(false)
    }
  }

  const confirmArchive = async () => {
    if (!archiveTarget) return
    setBusy(true)
    try {
      await deleteSubject(archiveTarget.id)
      setNotice(`${archiveTarget.name} archived`)
      setArchiveTarget(null)
      fetchAll()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to archive subject')
      setArchiveTarget(null)
    } finally {
      setBusy(false)
    }
  }

  const restore = async (subject: Subject) => {
    try {
      await updateSubject(subject.id, { status: 'ACTIVE' })
      setNotice(`${subject.name} restored`)
      fetchAll()
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to restore subject')
    }
  }

  const classesLink = (subject: Subject) => {
    const count = classCounts.get(subject.id) ?? 0
    return (
      <Button size="small" onClick={() => navigate(`/class-subjects?subject=${subject.id}`)}
        sx={{ minWidth: 0, px: 1, fontWeight: 600, color: count ? brand.green : brand.subtle }}
        aria-label={`See the ${count} classes that take ${subject.name}`}>
        {count} {count === 1 ? 'class' : 'classes'}
      </Button>
    )
  }

  const actions = (subject: Subject) =>
    canEdit &&
    (subject.status === 'INACTIVE' ? (
      <Tooltip title="Restore">
        <IconButton size="small" aria-label={`Restore ${subject.name}`} onClick={() => restore(subject)}>
          <RestoreIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    ) : (
      <>
        <Tooltip title="Edit">
          <IconButton size="small" aria-label={`Edit ${subject.name}`} onClick={() => openEdit(subject)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Archive">
          <IconButton size="small" aria-label={`Archive ${subject.name}`} onClick={() => setArchiveTarget(subject)}>
            <ArchiveIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </>
    ))

  return (
    <Box sx={{ flexGrow: 1, maxWidth: 1180, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 3, md: 4.5 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={{ xs: 1.5, sm: 2 }} sx={{ mb: 1 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>Subjects</Typography>
        {canEdit && (
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<ImportIcon />} onClick={() => setImportOpen(true)} size="small"
              sx={{ borderColor: brand.border, color: brand.text, bgcolor: brand.surface, '&:hover': { borderColor: '#d6d3c9', bgcolor: brand.surface }, whiteSpace: 'nowrap' }}>
              Import CSV
            </Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} size="small" sx={{ whiteSpace: 'nowrap' }}>
              Add Subject
            </Button>
          </Stack>
        )}
      </Stack>
      <Typography sx={{ color: brand.muted, fontSize: '14.5px', mb: 3 }}>
        Every subject your school teaches, listed once. Choose which classes take each one on{' '}
        <Box component="span" role="link" tabIndex={0} onClick={() => navigate('/class-subjects')}
          onKeyDown={(e) => e.key === 'Enter' && navigate('/class-subjects')}
          sx={{ color: brand.green, fontWeight: 600, cursor: 'pointer', '&:hover': { textDecoration: 'underline' } }}>
          Class subjects
        </Box>.
      </Typography>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search by name or code"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" color="action" /></InputAdornment> }}
        />
      </Paper>

      {archivedCount > 0 && (
        <FormControlLabel
          sx={{ mb: 1, ml: 0.25, '& .MuiFormControlLabel-label': { fontSize: '14px', color: brand.muted } }}
          control={<Switch size="small" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />}
          label={`Show archived subjects (${archivedCount})`}
        />
      )}

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress size={28} /></Box>
        ) : shown.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary">
              {subjects.length === 0 ? 'No subjects yet. Add the subjects your school teaches.' : 'No subjects match your search.'}
            </Typography>
          </Box>
        ) : isPhone ? (
          <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {shown.map((subject, i) => (
              <Box component="li" key={subject.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5,
                borderTop: i === 0 ? 'none' : `1px solid ${brand.border}`, opacity: subject.status === 'INACTIVE' ? 0.6 : 1 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 600, fontSize: '15px' }} noWrap>{subject.name}</Typography>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ fontSize: '13px', color: brand.muted }}>{subject.code}</Typography>
                    {classesLink(subject)}
                    {subject.status === 'INACTIVE' && <StatusBadge archived />}
                  </Stack>
                </Box>
                {actions(subject)}
              </Box>
            ))}
          </Box>
        ) : (
          <TableContainer>
            <Table sx={{ '& th': { color: brand.muted, fontWeight: 600, fontSize: '13px' } }}>
              <TableHead>
                <TableRow>
                  <TableCell>Subject</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Taught in</TableCell>
                  <TableCell>Status</TableCell>
                  {canEdit && <TableCell align="right">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {shown.map((subject) => (
                  <TableRow key={subject.id} hover sx={{ opacity: subject.status === 'INACTIVE' ? 0.6 : 1 }}>
                    <TableCell sx={{ fontWeight: 600 }}>{subject.name}</TableCell>
                    <TableCell sx={{ color: brand.muted, fontFamily: 'ui-monospace, Menlo, monospace !important', fontSize: '13px' }}>{subject.code}</TableCell>
                    <TableCell>{classesLink(subject)}</TableCell>
                    <TableCell><StatusBadge archived={subject.status === 'INACTIVE'} /></TableCell>
                    {canEdit && <TableCell align="right">{actions(subject)}</TableCell>}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Add / edit */}
      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>{editing ? `Edit ${editing.name}` : 'Add subject'}</DialogTitle>
        <DialogContent>
          {formError && <Alert severity="error" sx={{ mb: 2, mt: 1 }}>{formError}</Alert>}
          <TextField fullWidth autoFocus label="Subject name" placeholder="e.g. Mathematics" margin="dense" required
            value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField fullWidth label="Subject code" placeholder="e.g. MTH" margin="dense" required
            helperText="A short code that's unique in your school"
            inputProps={{ maxLength: 20, style: { textTransform: 'uppercase' } }}
            value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving || !form.name.trim() || !form.code.trim()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Archive */}
      <Dialog open={!!archiveTarget} onClose={() => !busy && setArchiveTarget(null)} maxWidth="xs" fullWidth>
        {archiveTarget && (
          <>
            <DialogTitle sx={{ fontWeight: 700 }}>Archive {archiveTarget.name}?</DialogTitle>
            <DialogContent>
              <Typography variant="body2" sx={{ color: brand.muted }}>
                It will be hidden from your subject list and can't be added to classes.
                {(classCounts.get(archiveTarget.id) ?? 0) > 0 &&
                  ` It's currently taught in ${classCounts.get(archiveTarget.id)} ${classCounts.get(archiveTarget.id) === 1 ? 'class' : 'classes'}; those stay listed until you remove them.`}{' '}
                Past exams and results keep it, and you can restore it any time.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => setArchiveTarget(null)} disabled={busy}>Cancel</Button>
              <Button variant="contained" onClick={confirmArchive} disabled={busy}>{busy ? 'Archiving…' : 'Archive'}</Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      <Snackbar open={!!notice} autoHideDuration={3000} onClose={() => setNotice('')} message={notice} />

      <BulkImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onSuccess={fetchAll}
        title="Import Subjects"
        endpoint="/subjects/bulk-import"
        columns={subjectColumns}
      />
    </Box>
  )
}
