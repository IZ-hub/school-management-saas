import { Box } from '@mui/material'

/** School Precise colours, from the brand board. */
export const brandColors = {
  night: '#0f2a24',
  forest: '#0e5c43',
  mint: '#3fb68b',
  gold: '#e0a52e',
  cream: '#faf4ea',
}

interface MarkProps {
  size?: number
  /** 'default' for light backgrounds, 'reversed' for dark ones. */
  variant?: 'default' | 'reversed'
  /** Background behind the mark: the thin gap between spine and page is cut in this colour. */
  gap?: string
  title?: string
}

/**
 * The "Page P": a P whose stem is a book's spine and whose bowl is a page with a turned corner,
 * three lines that shorten (a précis) and a gold point. Below 40px the spine gap and third line
 * are dropped so it stays crisp.
 */
export function BrandMark({ size = 32, variant = 'default', gap, title }: MarkProps) {
  const reversed = variant === 'reversed'
  const body = reversed ? brandColors.mint : brandColors.forest
  const fold = reversed ? brandColors.cream : brandColors.mint
  const lines = reversed ? brandColors.night : brandColors.cream
  const cut = gap ?? (reversed ? brandColors.night : '#ffffff')
  const small = size < 40
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} style={{ display: 'block', flexShrink: 0 }}>
      <path d="M22 22a6 6 0 0 1 6-6h52l18 18v26c0 11-9 20-20 20H44v18a6 6 0 0 1-6 6H28a6 6 0 0 1-6-6Z" fill={body} />
      <path d="M80 16v12a6 6 0 0 0 6 6h12Z" fill={fold} />
      {small ? (
        <>
          <path d="M54 37h28M54 49h20M54 61h8" stroke={lines} strokeWidth="7.5" strokeLinecap="round" fill="none" />
          <circle cx="75" cy="61" r="5.5" fill={brandColors.gold} />
        </>
      ) : (
        <>
          <path d="M44 16v64" stroke={cut} strokeWidth="3" />
          <path d="M54 37h28M54 49h20M54 61h10" stroke={lines} strokeWidth="6" strokeLinecap="round" fill="none" />
          <circle cx="75" cy="61" r="4.5" fill={brandColors.gold} />
        </>
      )}
    </svg>
  )
}

interface WordmarkProps {
  fontSize?: number | string | Record<string, string>
  /** Colour of "School" and of "Precise". */
  first?: string
  second?: string
}

/** "School Precise", with the gold point dotting the i. */
export function Wordmark({ fontSize = 17, first = brandColors.night, second = brandColors.forest }: WordmarkProps) {
  return (
    <Box component="span" aria-label="School Precise" sx={{ fontSize, lineHeight: 1, letterSpacing: '-0.035em', whiteSpace: 'nowrap', fontFamily: '"Plus Jakarta Sans", sans-serif' }}>
      <Box component="span" aria-hidden sx={{ fontWeight: 600, color: first }}>School</Box>{' '}
      <Box component="span" aria-hidden sx={{ fontWeight: 800, color: second }}>
        Prec
        <Box component="span" sx={{ position: 'relative', display: 'inline-block', lineHeight: 1 }}>
          ı
          <Box component="span" sx={{ position: 'absolute', left: '50%', top: '0.12em', width: '0.17em', height: '0.17em', ml: '-0.085em', borderRadius: '50%', bgcolor: brandColors.gold }} />
        </Box>
        se
      </Box>
    </Box>
  )
}
