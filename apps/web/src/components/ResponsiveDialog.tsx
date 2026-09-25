import { Dialog, DialogProps, useMediaQuery, useTheme } from '@mui/material'

/** Dialog that goes full screen on phones so long forms stay usable. */
export default function ResponsiveDialog(props: DialogProps) {
  const theme = useTheme()
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'))

  return <Dialog fullScreen={fullScreen} {...props} />
}
