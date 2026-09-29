import { ReactNode } from 'react'
import { Avatar, Box, Link as MuiLink, Stack, TextField, TextFieldProps, Typography } from '@mui/material'
import { School as SchoolIcon } from '@mui/icons-material'
import { Link } from 'react-router-dom'

export const authColors = {
  page: '#f6f6f1',
  card: '#fbfbf8',
  border: '#e5e5dc',
  input: '#f0f0ea',
  brand: '#0d3b2e',
  brandHover: '#14523f',
  logo: '#1b5e20',
  muted: '#6b7064',
}

/** Schoolful LMS logo mark and name. */
export function BrandLogo() {
  return (
    <Stack component={Link} to="/" direction="row" spacing={1.25} alignItems="center" sx={{ textDecoration: 'none' }}>
      <Avatar sx={{ bgcolor: authColors.logo, width: 38, height: 38 }}>
        <SchoolIcon sx={{ fontSize: 21, color: '#fff' }} />
      </Avatar>
      <Typography sx={{ fontWeight: 800, fontSize: '1.15rem', color: '#111', letterSpacing: '-0.3px' }}>
        Schoolful LMS
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

/** Full-page layout for sign-in and registration: top bar with logo, then a title and the form. */
export function AuthShell({ title, subtitle, topLinkPrompt, topLinkLabel, topLinkTo, children }: AuthShellProps) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: authColors.page }}>
      <Box component="header" sx={{ borderBottom: `1px solid ${authColors.border}` }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ maxWidth: 1040, mx: 'auto', px: { xs: 2, sm: 4 }, py: { xs: 1.5, sm: 2 }, gap: 2 }}
        >
          <BrandLogo />
          <Typography variant="body2" sx={{ color: authColors.muted, textAlign: 'right' }}>
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{topLinkPrompt} </Box>
            <MuiLink component={Link} to={topLinkTo} underline="hover" sx={{ color: authColors.brand, fontWeight: 600 }}>
              {topLinkLabel}
            </MuiLink>
          </Typography>
        </Stack>
      </Box>

      <Box component="main" sx={{ maxWidth: 1040, mx: 'auto', px: { xs: 2, sm: 4 }, pt: { xs: 4, sm: 6 }, pb: 8 }}>
        <Typography variant="h1" sx={{ fontWeight: 800, fontSize: { xs: '1.75rem', sm: '2.2rem' }, letterSpacing: '-0.8px', color: '#1a1d17', mb: 0.75 }}>
          {title}
        </Typography>
        <Typography component="div" variant="body1" sx={{ color: authColors.muted, mb: { xs: 3, sm: 4 } }}>
          {subtitle}
        </Typography>
        {children}
      </Box>
    </Box>
  )
}

/** Bordered card that holds the form fields. */
export function AuthCard({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ bgcolor: authColors.card, border: `1px solid ${authColors.border}`, borderRadius: 3, p: { xs: 2.5, sm: 4 } }}>
      {children}
    </Box>
  )
}

type AuthFieldProps = Omit<TextFieldProps, 'label' | 'error'> & {
  id: string
  label: string
  error?: string
}

/** Text field with its label above the input, as in the sign-in design. */
export function AuthField({ id, label, error, helperText, required, ...props }: AuthFieldProps) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography component="label" htmlFor={id} sx={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', color: '#2b2f27', mb: 0.75 }}>
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
            borderRadius: 2.5,
            fontSize: '1rem', // 16px keeps iOS from zooming on focus
            '& fieldset': { borderColor: authColors.border },
            '&:hover fieldset': { borderColor: '#c9c9bd' },
            '&.Mui-focused fieldset': { borderColor: authColors.brand, borderWidth: 2 },
            '&.Mui-error fieldset': { borderColor: '#b3261e' },
          },
          '& .MuiOutlinedInput-input': { py: 1.6 },
          '& .MuiFormHelperText-root': { mx: 0.25 },
          ...props.sx,
        }}
      />
    </Box>
  )
}

export const primaryButtonSx = {
  bgcolor: authColors.brand,
  color: '#fff',
  textTransform: 'none',
  fontWeight: 700,
  fontSize: '1rem',
  borderRadius: 2.5,
  py: 1.5,
  boxShadow: 'none',
  '&:hover': { bgcolor: authColors.brandHover, boxShadow: 'none' },
  '&.Mui-disabled': { bgcolor: '#6f8a80', color: '#fff' },
} as const

/** Turns an API or network failure into a message a user can act on. */
export function describeError(err: any, fallback: string): string {
  if (!err?.response) {
    return "Couldn't reach Schoolful LMS. Check your internet connection and try again."
  }
  const message = err.response.data?.message
  if (Array.isArray(message)) return message.join('. ')
  return message || fallback
}
