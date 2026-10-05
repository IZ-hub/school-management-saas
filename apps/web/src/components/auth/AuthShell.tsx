import { ReactNode } from 'react'
import { Avatar, Box, Stack, TextField, TextFieldProps, Typography } from '@mui/material'
import { School as SchoolIcon } from '@mui/icons-material'
import { Link } from 'react-router-dom'

export const authColors = {
  page: '#f9f8f3',
  card: '#ffffff',
  border: '#dfddd5',
  input: '#f9f8f3',
  text: '#0f1511',
  muted: '#5b615b',
  brand: '#0d3b2e',
  brandHover: '#14523f',
  logo: '#1b5e20',
}

const authFont = '"Plus Jakarta Sans", "Inter", "Helvetica", "Arial", sans-serif'

/** SchoolBricks logo mark and name. */
export function BrandLogo() {
  return (
    <Stack component={Link} to="/" direction="row" spacing={1} alignItems="center" sx={{ textDecoration: 'none' }}>
      <Avatar sx={{ bgcolor: authColors.logo, width: 36, height: 36 }}>
        <SchoolIcon sx={{ fontSize: 20, color: '#fff' }} />
      </Avatar>
      <Typography sx={{ fontWeight: 800, fontSize: '20px', color: authColors.brand, letterSpacing: '-0.2px' }}>
        SchoolBricks
      </Typography>
    </Stack>
  )
}

interface AuthShellProps {
  title: string
  subtitle: ReactNode
  topLinkPrompt: string
  topLinkLabel: string
  topLinkTo: string
  children: ReactNode
}

// Content column: 1160px wide with 60px side margins on desktop, 20px on phones.
const column = { maxWidth: 1280, mx: 'auto', px: { xs: '20px', sm: '40px', md: '60px' } }

/** Full-page layout for sign-in and registration: top bar with logo, then a title and the form. */
export function AuthShell({ title, subtitle, topLinkPrompt, topLinkLabel, topLinkTo, children }: AuthShellProps) {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: authColors.page,
        color: authColors.text,
        fontFamily: authFont,
        // MUI components set their own font; point them all at the auth font.
        '& .MuiTypography-root, & .MuiInputBase-root, & .MuiButton-root, & .MuiAlert-message, & .MuiFormHelperText-root': {
          fontFamily: authFont,
        },
      }}
    >
      <Box component="header" sx={{ borderBottom: `1px solid ${authColors.border}` }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ ...column, height: 64, gap: 2 }}>
          <BrandLogo />
          <Typography
            component={Link}
            to={topLinkTo}
            sx={{ fontSize: '14px', fontWeight: 500, color: authColors.muted, textDecoration: 'none', '&:hover': { color: authColors.text } }}
          >
            {/* The prompt doesn't fit beside the longer brand name on phones */}
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{topLinkPrompt} </Box>
            {topLinkLabel}
          </Typography>
        </Stack>
      </Box>

      <Box component="main" sx={{ ...column, pt: '48px', pb: 8 }}>
        <Typography component="h1" sx={{ fontWeight: 800, fontSize: '30px', lineHeight: '36px', letterSpacing: '-0.6px', color: authColors.text }}>
          {title}
        </Typography>
        <Typography component="div" sx={{ fontSize: '16px', lineHeight: '24px', color: authColors.muted, mt: '8px', mb: '24px' }}>
          {subtitle}
        </Typography>
        {children}
      </Box>
    </Box>
  )
}

/** White bordered card that holds the form fields. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ bgcolor: authColors.card, border: `1px solid ${authColors.border}`, borderRadius: '16px', p: '24px' }}>
      {children}
    </Box>
  )
}

type AuthFieldProps = Omit<TextFieldProps, 'label' | 'error'> & {
  id: string
  label: string
  error?: string
}

/** Text field with its label above the input. */
export function AuthField({ id, label, error, helperText, required, ...props }: AuthFieldProps) {
  return (
    <Box sx={{ mb: '16px' }}>
      <Typography component="label" htmlFor={id} sx={{ display: 'block', fontWeight: 500, fontSize: '14px', lineHeight: '20px', color: authColors.text, mb: '6px' }}>
        {label}
        {required && <Box component="span" sx={{ color: '#b3261e', ml: 0.25 }} aria-hidden>*</Box>}
      </Typography>
      <TextField
        id={id}
        fullWidth
        required={required}
        error={!!error}
        helperText={error || helperText}
        {...props}
        sx={{
          '& .MuiOutlinedInput-root': {
            bgcolor: authColors.input,
            borderRadius: '12px',
            minHeight: 44,
            // 16px on phones stops iOS zooming in on focus; 14px from tablet up
            fontSize: { xs: '16px', sm: '14px' },
            '& fieldset': { borderColor: authColors.border },
            '&:hover fieldset': { borderColor: '#c8c6bc' },
            '&.Mui-focused fieldset': { borderColor: authColors.brand, borderWidth: '1.5px' },
            '&.Mui-error fieldset': { borderColor: '#b3261e' },
          },
          '& .MuiOutlinedInput-input': { py: '11px', px: '12px' },
          '& .MuiInputAdornment-root .MuiIconButton-root': { color: authColors.muted },
          '& .MuiFormHelperText-root': { mx: 0.25, fontSize: '12.5px' },
          ...props.sx,
        }}
      />
    </Box>
  )
}

export const primaryButtonSx = {
  bgcolor: authColors.brand,
  color: '#fbfaf5',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '14px',
  borderRadius: '12px',
  height: 44,
  boxShadow: 'none',
  '&:hover': { bgcolor: authColors.brandHover, boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: '#6f8a80', color: '#fff' },
} as const

/** Turns an API or network failure into a message a user can act on. */
export function describeError(err: any, fallback: string): string {
  if (!err?.response) {
    return "Couldn't reach SchoolBricks. Check your internet connection and try again."
  }
  const message = err.response.data?.message
  if (Array.isArray(message)) return message.join('. ')
  return message || fallback
}
