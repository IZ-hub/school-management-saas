import { ReactNode } from 'react'
import { Box, Stack, Typography } from '@mui/material'

interface PageHeaderProps {
  title: string
  children?: ReactNode
}

/** Page title with action buttons that stack vertically on phones. */
export default function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'stretch', sm: 'center' }}
      spacing={{ xs: 1.5, sm: 2 }}
      sx={{ mb: { xs: 2, sm: 3 } }}
    >
      <Typography variant="h4" sx={{ flexGrow: 1, wordBreak: 'break-word' }}>
        {title}
      </Typography>
      {children && (
        <Box
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: { xs: 1, sm: 2 },
            '& > *': { flexShrink: 0 },
          }}
        >
          {children}
        </Box>
      )}
    </Stack>
  )
}
