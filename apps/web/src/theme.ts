import { createTheme } from '@mui/material/styles'

/** Schoolful LMS brand tokens shared by the app shell and dashboard. */
export const brand = {
  green: '#0d3b2e',
  greenHover: '#14523f',
  greenSoft: '#eef3ec',
  accent: '#8bc34a',
  page: '#f9f8f3',
  surface: '#ffffff',
  border: '#e8e6df',
  text: '#141a15',
  muted: '#646b64',
  subtle: '#8c928b',
  font: '"Plus Jakarta Sans", "Inter", "Helvetica", "Arial", sans-serif',
}

const theme = createTheme({
  palette: {
    primary: {
      main: brand.green,
    },
    secondary: {
      main: '#dc004e',
    },
    background: {
      default: brand.page,
      paper: brand.surface,
    },
    divider: brand.border,
  },
  shape: {
    borderRadius: 10,
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      '@media (max-width:600px)': {
        fontSize: '1.5rem',
      },
    },
  },
  components: {
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        // The default raised surface becomes a flat card with a hairline border.
        elevation1: {
          boxShadow: 'none',
          border: `1px solid ${brand.border}`,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          '@media (max-width:600px)': {
            margin: 16,
            width: 'calc(100% - 32px)',
            maxHeight: 'calc(100% - 32px)',
          },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: {
          overflowX: 'auto',
          WebkitOverflowScrolling: 'touch',
        },
      },
    },
  },
})

export default theme
