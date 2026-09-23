import { useState, useRef } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Alert,
  Stack,
  Chip,
  CircularProgress,
  Link,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@mui/icons-material'
import Papa from 'papaparse'
import { api } from '../lib/api'

export interface ColumnDef {
  key: string
  label: string
  required?: boolean
}

interface BulkImportDialogProps {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  title: string
  endpoint: string
  columns: ColumnDef[]
}

export default function BulkImportDialog({
  open,
  onClose,
  onSuccess,
  title,
  endpoint,
  columns,
}: BulkImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: { row: number; message: string }[] } | null>(null)

  const reset = () => {
    setRows([])
    setFileName('')
    setParseError('')
    setResult(null)
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setParseError('')
    setResult(null)
    setFileName(file.name)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          setParseError(`CSV parse error: ${results.errors[0].message}`)
          return
        }
        const data = results.data as Record<string, string>[]
        if (data.length === 0) {
          setParseError('The file is empty')
          return
        }
        if (data.length > 500) {
          setParseError('Maximum 500 rows per import. Please split your file.')
          return
        }
        setRows(data)
      },
      error: (err) => {
        setParseError(`Failed to read file: ${err.message}`)
      },
    })
    // Reset file input so same file can be re-selected
    e.target.value = ''
  }

  const handleImport = async () => {
    setImporting(true)
    setResult(null)
    try {
      const mapped = rows.map((row) => {
        const record: Record<string, string> = {}
        columns.forEach((col) => {
          // Try exact key match first, then case-insensitive
          const val =
            row[col.key] ??
            row[col.label] ??
            Object.entries(row).find(
              ([k]) => k.toLowerCase().trim() === col.key.toLowerCase() || k.toLowerCase().trim() === col.label.toLowerCase(),
            )?.[1] ??
            ''
          if (val) record[col.key] = val.trim()
        })
        return record
      })
      const resp = await api.post(endpoint, { records: mapped })
      setResult(resp.data.data)
      if (resp.data.data.imported > 0) {
        onSuccess()
      }
    } catch (err: any) {
      setResult({ imported: 0, errors: [{ row: 0, message: err.response?.data?.message || 'Import failed' }] })
    } finally {
      setImporting(false)
    }
  }

  const downloadTemplate = () => {
    const headers = columns.map((c) => c.key).join(',')
    const sample = columns.map((c) => (c.required ? `sample_${c.key}` : '')).join(',')
    const csv = `${headers}\n${sample}\n`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const requiredCols = columns.filter((c) => c.required)
  const previewRows = rows.slice(0, 5)

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        {title}
      </DialogTitle>
      <DialogContent>
        {/* Step 1: Instructions */}
        {!result && (
          <>
            <Stack spacing={2} sx={{ mb: 3 }}>
              <Typography variant="body2" color="text.secondary">
                Upload a CSV file to import multiple records at once. Maximum 500 rows per import.
              </Typography>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Required columns:</Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                  {requiredCols.map((c) => (
                    <Chip key={c.key} label={c.key} size="small" color="primary" variant="outlined" />
                  ))}
                </Stack>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Optional columns:</Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                  {columns.filter((c) => !c.required).map((c) => (
                    <Chip key={c.key} label={c.key} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Box>
              <Link component="button" variant="body2" onClick={downloadTemplate} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#1976d2' }}>
                <DownloadIcon sx={{ fontSize: 16 }} /> Download CSV template
              </Link>
            </Stack>

            {/* File upload area */}
            <Box
              onClick={() => fileRef.current?.click()}
              sx={{
                border: '2px dashed #ccc',
                borderRadius: 2,
                p: 4,
                textAlign: 'center',
                cursor: 'pointer',
                bgcolor: '#fafafa',
                transition: 'border-color 0.2s',
                '&:hover': { borderColor: '#999' },
                mb: 2,
              }}
            >
              <input ref={fileRef} type="file" accept=".csv,.txt" hidden onChange={handleFileSelect} />
              <UploadIcon sx={{ fontSize: 40, color: '#999', mb: 1 }} />
              <Typography variant="body1" sx={{ fontWeight: 600, color: '#555' }}>
                {fileName || 'Click to upload CSV file'}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Supports .csv files
              </Typography>
            </Box>

            {parseError && <Alert severity="error" sx={{ mb: 2 }}>{parseError}</Alert>}

            {/* Preview table */}
            {rows.length > 0 && (
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Preview ({rows.length} rows total{rows.length > 5 ? ', showing first 5' : ''})
                </Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>#</TableCell>
                        {columns.map((c) => (
                          <TableCell key={c.key} sx={{ fontWeight: 700, fontSize: '0.75rem' }}>
                            {c.label} {c.required && '*'}
                          </TableCell>
                        ))}
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {previewRows.map((row, i) => (
                        <TableRow key={i}>
                          <TableCell sx={{ fontSize: '0.75rem' }}>{i + 1}</TableCell>
                          {columns.map((c) => {
                            const val =
                              row[c.key] ??
                              row[c.label] ??
                              Object.entries(row).find(
                                ([k]) => k.toLowerCase().trim() === c.key.toLowerCase() || k.toLowerCase().trim() === c.label.toLowerCase(),
                              )?.[1] ??
                              ''
                            return (
                              <TableCell key={c.key} sx={{ fontSize: '0.75rem', color: c.required && !val ? '#d32f2f' : '#333' }}>
                                {val || (c.required ? 'MISSING' : '—')}
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </Box>
            )}
          </>
        )}

        {/* Results */}
        {result && (
          <Box sx={{ textAlign: 'center', py: 3 }}>
            {result.imported > 0 ? (
              <>
                <CheckIcon sx={{ fontSize: 48, color: '#2e7d32', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  {result.imported} records imported successfully!
                </Typography>
              </>
            ) : (
              <>
                <ErrorIcon sx={{ fontSize: 48, color: '#d32f2f', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>Import failed</Typography>
              </>
            )}
            {result.errors.length > 0 && (
              <Box sx={{ mt: 2, textAlign: 'left' }}>
                <Alert severity="warning" sx={{ mb: 1 }}>
                  {result.errors.length} row(s) had errors:
                </Alert>
                {result.errors.slice(0, 10).map((e, i) => (
                  <Typography key={i} variant="body2" sx={{ color: '#d32f2f', ml: 1 }}>
                    Row {e.row}: {e.message}
                  </Typography>
                ))}
                {result.errors.length > 10 && (
                  <Typography variant="body2" sx={{ color: '#888', ml: 1, mt: 0.5 }}>
                    ...and {result.errors.length - 10} more
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={handleClose}>{result ? 'Close' : 'Cancel'}</Button>
        {!result && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={rows.length === 0 || importing}
            startIcon={importing ? <CircularProgress size={16} /> : <UploadIcon />}
            sx={{ bgcolor: '#111', '&:hover': { bgcolor: '#333' } }}
          >
            {importing ? 'Importing...' : `Import ${rows.length} Records`}
          </Button>
        )}
        {result && result.imported > 0 && (
          <Button variant="contained" onClick={handleClose} sx={{ bgcolor: '#111', '&:hover': { bgcolor: '#333' } }}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
