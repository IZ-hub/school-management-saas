import { ReactNode, useEffect, useState } from 'react'
import { Box, Button, Container, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { CheckCircle as DoneIcon, IosShare as ShareIcon, MoreVert as MenuIcon, AddBoxOutlined as AddIcon, InstallDesktop as DesktopIcon, PhoneAndroid as AndroidIcon, PhoneIphone as IphoneIcon } from '@mui/icons-material'
import { BrandMark, Wordmark } from '../components/Brand'
import { brand } from '../theme'
import { isAndroid, isIos, useInstall } from '../lib/install'

const C = { ink: '#10241c', body: '#3f4a44', muted: '#5f6a63', cream: '#faf4ea', line: '#e9e0d0', green: '#0e5c43', mint: '#3fb68b', night: '#0f2a24' }
type Device = 'android' | 'iphone' | 'computer'

function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <Stack direction="row" spacing={1.5} alignItems="flex-start">
      <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: C.green, color: '#fff', fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{n}</Box>
      <Typography sx={{ color: C.body, lineHeight: 1.6, pt: 0.25 }}>{children}</Typography>
    </Stack>
  )
}
const Icon = ({ children }: { children: ReactNode }) => (
  <Box component="span" sx={{ display: 'inline-flex', verticalAlign: 'middle', mx: 0.25, color: C.ink, '& svg': { fontSize: 19 } }}>{children}</Box>
)

/** "Install School Precise": one tap where the browser allows it, otherwise clear steps for the visitor's phone. */
export default function InstallPage() {
  const { installed, canPrompt, prompt } = useInstall()
  const [device, setDevice] = useState<Device>(isIos() ? 'iphone' : isAndroid() ? 'android' : 'computer')
  const [justInstalled, setJustInstalled] = useState(false)

  useEffect(() => {
    const previous = document.title
    document.title = 'Install the app · School Precise'
    return () => { document.title = previous }
  }, [])

  const tabs: { id: Device; label: string; icon: ReactNode }[] = [
    { id: 'android', label: 'Android', icon: <AndroidIcon /> },
    { id: 'iphone', label: 'iPhone / iPad', icon: <IphoneIcon /> },
    { id: 'computer', label: 'Computer', icon: <DesktopIcon /> },
  ]

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: C.cream, '& .MuiTypography-root, & .MuiButton-root': { fontFamily: brand.font } }}>
      <Box component="header" sx={{ borderBottom: `1px solid ${C.line}`, bgcolor: '#fff' }}>
        <Container maxWidth="sm" sx={{ height: 64, display: 'flex', alignItems: 'center' }}>
          <Box component={Link} to="/" aria-label="School Precise home" sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}>
            <BrandMark size={30} />
            <Wordmark fontSize={17} />
          </Box>
        </Container>
      </Box>

      <Container maxWidth="sm" component="main" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack alignItems="center" textAlign="center" spacing={1.5} sx={{ mb: 4 }}>
          <Box component="img" src="/icons/icon-192.png" alt="" sx={{ width: 84, height: 84, borderRadius: '20px', boxShadow: '0 14px 30px -14px rgba(15,42,36,0.6)' }} />
          <Typography component="h1" sx={{ fontWeight: 800, fontSize: { xs: '1.9rem', md: '2.3rem' }, letterSpacing: '-0.8px', color: C.ink }}>Install School Precise</Typography>
          <Typography sx={{ color: C.body, maxWidth: 440, lineHeight: 1.6 }}>
            Put School Precise on your home screen. It opens full-screen like any other app, and always has the latest version. Nothing to pay, no app store needed.
          </Typography>
        </Stack>

        {installed || justInstalled ? (
          <Stack alignItems="center" spacing={2} sx={{ p: 3, borderRadius: '18px', bgcolor: '#e3f4ec', textAlign: 'center' }}>
            <DoneIcon sx={{ fontSize: 40, color: C.green }} />
            <Typography sx={{ fontWeight: 800, color: C.ink }}>School Precise is installed</Typography>
            <Typography sx={{ color: C.body }}>Open it from your home screen or app list.</Typography>
            <Button component={Link} to="/login" variant="contained" sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 700, bgcolor: C.green, '&:hover': { bgcolor: '#0b4a36' } }}>Sign in</Button>
          </Stack>
        ) : (
          <>
            {canPrompt && (
              <Stack alignItems="center" spacing={1} sx={{ mb: 4 }}>
                <Button size="large" variant="contained" onClick={async () => setJustInstalled(await prompt())}
                  sx={{ borderRadius: 999, textTransform: 'none', fontWeight: 800, fontSize: '1.05rem', px: 5, height: 56, bgcolor: C.mint, color: C.night, boxShadow: 'none', '&:hover': { bgcolor: '#52c79b', boxShadow: 'none' } }}>
                  Install now
                </Button>
                <Typography sx={{ fontSize: '0.88rem', color: C.muted }}>One tap. Then confirm “Install”.</Typography>
              </Stack>
            )}

            <Box role="tablist" aria-label="Your device" sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0.5, p: 0.5, mb: 2.5, bgcolor: '#fff', border: `1px solid ${C.line}`, borderRadius: '14px' }}>
              {tabs.map((t) => (
                <Button key={t.id} role="tab" aria-selected={device === t.id} onClick={() => setDevice(t.id)} startIcon={t.icon}
                  sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', height: 44, fontSize: { xs: '0.82rem', sm: '0.92rem' }, minWidth: 0,
                    bgcolor: device === t.id ? C.green : 'transparent', color: device === t.id ? '#fff' : C.body, '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } },
                    '&:hover': { bgcolor: device === t.id ? '#0b4a36' : '#e3f4ec' } }}>
                  {t.label}
                </Button>
              ))}
            </Box>

            <Stack spacing={2} sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: '18px', bgcolor: '#fff', border: `1px solid ${C.line}` }}>
              {device === 'android' && (
                <>
                  <Step n={1}>Open <b>schoolprecise.com</b> in <b>Chrome</b>.</Step>
                  <Step n={2}>Tap <b>Install now</b> above, or tap the menu <Icon><MenuIcon /></Icon> (top right) and choose <b>Install app</b> or <b>Add to Home screen</b>.</Step>
                  <Step n={3}>Tap <b>Install</b>. School Precise appears on your home screen and in your apps.</Step>
                </>
              )}
              {device === 'iphone' && (
                <>
                  <Step n={1}>Open <b>schoolprecise.com</b> in <b>Safari</b> (the iPhone’s own browser).</Step>
                  <Step n={2}>Tap the <b>Share</b> button <Icon><ShareIcon /></Icon> at the bottom of the screen.</Step>
                  <Step n={3}>Scroll down and tap <b>Add to Home Screen</b> <Icon><AddIcon /></Icon>, then tap <b>Add</b>.</Step>
                </>
              )}
              {device === 'computer' && (
                <>
                  <Step n={1}>Open <b>schoolprecise.com</b> in <b>Chrome</b> or <b>Microsoft Edge</b>.</Step>
                  <Step n={2}>Click <b>Install now</b> above, or the install icon <Icon><DesktopIcon /></Icon> at the right of the address bar.</Step>
                  <Step n={3}>Click <b>Install</b>. School Precise opens in its own window and is added to your apps.</Step>
                </>
              )}
            </Stack>
          </>
        )}

        <Typography sx={{ textAlign: 'center', color: C.muted, fontSize: '0.9rem', mt: 4 }}>
          Need help? Email <Box component="a" href="mailto:hello@schoolprecise.com" sx={{ color: C.green, fontWeight: 600 }}>hello@schoolprecise.com</Box>
        </Typography>
      </Container>
    </Box>
  )
}
