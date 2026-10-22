import { Avatar } from '@mui/material'
import { brand } from '../theme'

/** A student's photo, or their initials when there is none. */
export default function StudentAvatar({ src, firstName, lastName, size = 36 }: { src?: string | null; firstName?: string; lastName?: string; size?: number }) {
  return (
    <Avatar src={src || undefined} alt={`${firstName ?? ''} ${lastName ?? ''}`.trim()}
      sx={{ width: size, height: size, bgcolor: brand.greenSoft, color: brand.green, fontSize: Math.round(size * 0.36), fontWeight: 700, flexShrink: 0 }}>
      {((firstName?.[0] ?? '') + (lastName?.[0] ?? '')).toUpperCase()}
    </Avatar>
  )
}
