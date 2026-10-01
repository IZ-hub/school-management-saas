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

/** "Class Name", "className", "class_name" and "CLASS NAME" all compare equal. */
const norm = (s: string) => s.replace(/^\uFEFF/, '').toLowerCase().replace(/[\s_-]+/g, '')

const matchesColumn = (header: string, col: ColumnDef) => {
  const h = norm(header)
  return h === norm(col.key) || h === norm(col.label)
}

const cellValue = (row: Record<string, string>, col: ColumnDef) =>
  (Object.entries(row).find(([header]) => matchesColumn(header, col))?.[1] ?? '').trim()

// Headings that only appear in another page's file, so we can point people to the right page.
const fileSignatures: Record<string, { headings: string[]; noun: string; page: string }> = {
  students: { headings: ['admissionnumber', 'admissionno'], noun: 'student list', page: 'Students' },
  teachers: { headings: ['employeenumber', 'staffnumber', 'staffid'], noun: 'teacher list', page: 'Teachers' },
  classes: { headings: ['gradelevel'], noun: 'class list', page: 'Classes' },
  subjects: { headings: ['subjectcode'], noun: 'subject list', page: 'Subjects' },
}

const joinNames = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

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
  const [headers, setHeaders] = useState<string[]>([])
  const [firstRow, setFirstRow] = useState<string[]>([])
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: { row: number; message: string }[] } | null>(null)

  const reset = () => {
    setRows([])
    setHeaders([])
    setFirstRow([])
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
    setRows([])
    setHeaders([])
    setFirstRow([])
    setFileName(file.name)

    // Read raw rows and build records ourselves, so the first row is shown exactly as written
    // (Papa's header mode renames repeated headings, e.g. "JSS 1" twice becomes "JSS 1_1").
    Papa.parse<string[]>(file, {
      skipEmptyLines: 'greedy',
      complete: (results) => {
        // A one-column file can't have its delimiter detected; that's harmless.
        const fatal = results.errors.find((err) => err.code !== 'UndetectableDelimiter')
        if (fatal) {
          setParseError(`We couldn't read this file: ${fatal.message}. Make sure it was saved as CSV.`)
          return
        }
        const [head = [], ...body] = results.data
        const fields = head.map((h) => (h ?? '').replace(/^﻿/, '').trim())
        if (body.length === 0) {
          setParseError('This file has no rows under the headings.')
          return
        }
        if (body.length > 500) {
          setParseError('You can import up to 500 rows at a time. Please split your file.')
          return
        }
        const data = body.map((cells) => {
          const row: Record<string, string> = {}
          fields.forEach((field, i) => {
            if (field && !(field in row)) row[field] = (cells[i] ?? '').trim()
          })
          return row
        })
        const named = fields.filter((f) => f !== '')
        setHeaders(named)
        setFirstRow(named)
        setRows(data)
      },
      error: (err) => {
        setParseError(`Failed to read file: ${err.message}`)
      },
    })
    // Reset file input so same file can be re-selected
    e.target.value = ''
  }

  const requiredCols = columns.filter((c) => c.required)
  const missingHeadings = rows.length > 0 ? requiredCols.filter((c) => !headers.some((h) => matchesColumn(h, c))) : []
  const readyRows = rows.filter((row) => requiredCols.every((c) => cellValue(row, c) !== ''))
  const skippedCount = rows.length - readyRows.length
  const missingInSkipped = requiredCols.filter((c) => rows.some((row) => cellValue(row, c) === ''))
  const orNames = (names: string[]) => joinNames(names).replace(/ and ([^,]+)$/, ' or $1')

  // If required headings are missing, see whether the file belongs on another page.
  const thisEntity = endpoint.split('/').filter(Boolean)[0]
  const otherPage =
    missingHeadings.length > 0
      ? Object.entries(fileSignatures).find(
          ([entity, sig]) => entity !== thisEntity && headers.some((h) => sig.headings.includes(norm(h))),
        )?.[1]
      : undefined

  // Rows skipped only because the record is already in the school (not a problem with the file).
  const isAlreadyThere = (message: string) => /already (belongs to|exists)|is also on row/.test(message)
  const nouns: Record<string, [string, string]> = {
    students: ['student', 'students'],
    teachers: ['teacher', 'teachers'],
    classes: ['class', 'classes'],
    subjects: ['subject', 'subjects'],
  }
  const [singular, plural] = nouns[thisEntity] ?? ['record', 'records']
  const allAlreadyThere =
    !!result && result.imported === 0 && result.errors.length > 0 && result.errors.every((e) => isAlreadyThere(e.message))

  const canImport = rows.length > 0 && missingHeadings.length === 0 && readyRows.length > 0 && !importing

  const handleImport = async () => {
    setImporting(true)
    setResult(null)
    try {
      // Send every row so the server's row numbers match the file; it skips incomplete rows.
      const mapped = rows.map((row) => {
        const record: Record<string, string> = {}
        columns.forEach((col) => {
          const val = cellValue(row, col)
          if (val) record[col.key] = val
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
    // Readable headings; the short keys (e.g. "firstName") are accepted too.
    const csv = `${columns.map((c) => c.label).join(',')}\n`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${title.toLowerCase().replace(/\s+/g, '_')}_template.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

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
                Upload a CSV file to import multiple records at once. The first row must contain the column headings. Maximum 500 rows per import.
              </Typography>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Required columns:</Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                  {requiredCols.map((c) => (
                    <Chip key={c.key} label={c.label} size="small" color="primary" variant="outlined" />
                  ))}
                </Stack>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Optional columns:</Typography>
                <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
                  {columns.filter((c) => !c.required).map((c) => (
                    <Chip key={c.key} label={c.label} size="small" variant="outlined" />
                  ))}
                </Stack>
              </Box>
              <Link component="button" variant="body2" onClick={downloadTemplate} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
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
                {fileName ? 'Click to choose a different file' : 'Supports .csv files'}
              </Typography>
            </Box>

            {parseError && <Alert severity="error" sx={{ mb: 2 }}>{parseError}</Alert>}

            {/* Problems that would make every row fail: explain and block the import */}
            {otherPage ? (
              <Alert severity="error" sx={{ mb: 2 }} role="alert">
                <strong>This file looks like a {otherPage.noun}.</strong> Import it on the <strong>{otherPage.page}</strong> page instead.
              </Alert>
            ) : missingHeadings.length > 0 ? (
              <Alert severity="error" sx={{ mb: 2 }} role="alert">
                <strong>We couldn't find the {missingHeadings.length === 1 ? 'column' : 'columns'} {joinNames(missingHeadings.map((c) => c.label))}.</strong>{' '}
                Check the first row of your file has headings.
                {firstRow.length > 0 && (
                  <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                    Your first row reads: {firstRow.slice(0, 6).map((h) => `"${h.replace(/^\uFEFF/, '')}"`).join(', ')}
                    {firstRow.length > 6 ? ', …' : ''}
                  </Box>
                )}
              </Alert>
            ) : rows.length > 0 && readyRows.length === 0 ? (
              <Alert severity="error" sx={{ mb: 2 }} role="alert">
                None of the rows have {joinNames(requiredCols.map((c) => c.label))} filled in. Fill them in and upload the file again.
              </Alert>
            ) : skippedCount > 0 ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {skippedCount} {skippedCount === 1 ? 'row is' : 'rows are'} missing{' '}
                {missingInSkipped.length === 1 ? `a ${missingInSkipped[0].label}` : `a ${orNames(missingInSkipped.map((c) => c.label))}`} and will be skipped.
              </Alert>
            ) : null}

            {/* Preview table */}
            {rows.length > 0 && !otherPage && (
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
                            const val = cellValue(row, c)
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
            {allAlreadyThere ? (
              <>
                <CheckIcon sx={{ fontSize: 48, color: '#2e7d32', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {result.errors.length === 1
                    ? `This ${singular} is already in your list.`
                    : `All ${result.errors.length} ${plural} are already in your list.`}
                </Typography>
                <Typography variant="body2" color="text.secondary">Nothing new to add.</Typography>
              </>
            ) : result.imported > 0 ? (
              <>
                <CheckIcon sx={{ fontSize: 48, color: '#2e7d32', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                  {result.imported} {result.imported === 1 ? 'record' : 'records'} imported successfully!
                </Typography>
              </>
            ) : (
              <>
                <ErrorIcon sx={{ fontSize: 48, color: '#d32f2f', mb: 1 }} />
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>No new records imported</Typography>
              </>
            )}
            {result.errors.length > 0 && !allAlreadyThere && (
              <Box sx={{ mt: 2, textAlign: 'left' }}>
                <Alert severity="warning" sx={{ mb: 1 }}>
                  {result.errors.length} {result.errors.length === 1 ? 'row was' : 'rows were'} skipped:
                </Alert>
                {result.errors.slice(0, 10).map((e, i) => (
                  <Typography key={i} variant="body2" sx={{ color: isAlreadyThere(e.message) ? '#6b7064' : '#d32f2f', ml: 1 }}>
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
            disabled={!canImport}
            startIcon={importing ? <CircularProgress size={16} color="inherit" /> : <UploadIcon />}
          >
            {importing ? 'Importing...' : canImport ? `Import ${readyRows.length} Records` : 'Import'}
          </Button>
        )}
        {result && (result.imported > 0 || allAlreadyThere) && (
          <Button variant="contained" onClick={handleClose}>
            Done
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}
