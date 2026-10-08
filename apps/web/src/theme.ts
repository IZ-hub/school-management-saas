import { createTheme } from '@mui/material/styles'

/** SchoolBricks brand tokens shared by the app shell and dashboard. */
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

/**
 * One calm colour per area of the app, used for icon badges and charts (never big blocks).
 * Hues come from a colour-blind-safe validated palette; `ink` is the darker step for icons and
 * text (5.4:1 or better on its tint), `solid` is for chart marks, `tint` for soft backgrounds.
 */
export const areas = {
  students: { solid: '#1baf7a', ink: '#0b6644', tint: '#e3f5ee' },
  teachers: { solid: '#4a3aa7', ink: '#4a3aa7', tint: '#ebe9f7' },
  classes: { solid: '#eda100', ink: '#7d5300', tint: '#fdf2d9' },
  attendance: { solid: '#3a9a5b', ink: '#1e6b3a', tint: '#e5f3ea' },
  fees: { solid: '#2a78d6', ink: '#1a569e', tint: '#e6eefa' },
  exams: { solid: '#eb6834', ink: '#a83f16', tint: '#fcebe3' },
} as const
export type Area = keyof typeof areas

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
