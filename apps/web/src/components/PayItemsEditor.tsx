import { Box, Button, IconButton, Stack, TextField, Typography } from '@mui/material'
import { Add as AddIcon, Close as RemoveIcon } from '@mui/icons-material'
import { brand } from '../theme'

export interface EditableItem { label: string; amount: string }

export const toEditable = (items: { label: string; amount: number }[]): EditableItem[] => items.map((i) => ({ label: i.label, amount: String(i.amount) }))
/** Rows with a name and an amount above zero; "₦20,000" and "20 000" are read as 20000. */
export const fromEditable = (items: EditableItem[]) =>
  items.map((i) => ({ label: i.label.trim(), amount: Number(i.amount.replace(/[₦,\s]/g, '')) })).filter((i) => i.label && Number.isFinite(i.amount) && i.amount > 0)

/** A short list of named amounts, such as allowances or deductions. */
export default function PayItemsEditor({ title, items, onChange, examples, addLabel }: {
  title: string
  items: EditableItem[]
  onChange: (items: EditableItem[]) => void
  examples: [string, string]
  addLabel: string
}) {
  const set = (i: number, patch: Partial<EditableItem>) => onChange(items.map((x, j) => (j === i ? { ...x, ...patch } : x)))
  return (
    <Box>
      <Typography sx={{ fontSize: '13px', fontWeight: 700, color: brand.muted, mb: 0.75 }}>{title}</Typography>
      <Stack spacing={1}>
        {items.map((item, i) => (
          <Stack key={i} direction="row" spacing={1} alignItems="center">
            <TextField size="small" label="Name" placeholder={`e.g. ${examples[0]}`} value={item.label} onChange={(e) => set(i, { label: e.target.value })} sx={{ flex: 1 }} />
            <TextField size="small" label="Amount (₦)" placeholder={`e.g. ${examples[1]}`} value={item.amount} inputProps={{ inputMode: 'decimal' }}
              onChange={(e) => set(i, { amount: e.target.value })} sx={{ width: 140 }} />
            <IconButton size="small" aria-label={`Remove ${item.label || 'this line'}`} onClick={() => onChange(items.filter((_, j) => j !== i))}><RemoveIcon fontSize="small" /></IconButton>
          </Stack>
        ))}
      </Stack>
      <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...items, { label: '', amount: '' }])} sx={{ mt: 0.5 }}>{addLabel}</Button>
    </Box>
  )
}
