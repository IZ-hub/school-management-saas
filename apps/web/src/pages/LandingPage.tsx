import { ReactNode, useEffect, useState } from 'react'
import {
  GlobalStyles,
  Box,
  Typography,
  Button,
  Container,
  Grid,
  Stack,
  TextField,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  CircularProgress,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import {
  Check as CheckIcon,
  ArrowForward as ArrowIcon,
  Send as SendIcon,
  WhatsApp as WhatsAppIcon,
  PhoneOutlined as PhoneIcon,
  LocationOnOutlined as LocationIcon,
  Add as PlusIcon,
  MenuBookOutlined as GuideIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  School as LogoIcon,
} from '@mui/icons-material'
import { api } from '../lib/api'
import { brand } from '../theme'

/* ─── Palette: the app's deep green and lemon on a warm cream page ─── */
const C = {
  green: brand.green,
  green2: '#14523f',
  night: '#08241c',
  lemon: brand.lemon,
  lemonHover: brand.lemonHover,
  lemonSoft: brand.lemonSoft,
  lemonInk: brand.lemonInk,
  link: '#2f7a12',
  ink: '#10241c',
  body: '#3f4a44',
  muted: '#5f6a63',
  cream: '#faf4ea',
  line: '#e9e0d0',
}

const WHATSAPP = '2347061102797'

const btn = { textTransform: 'none', fontWeight: 700, borderRadius: '999px', boxShadow: 'none', '&:hover': { boxShadow: 'none' } } as const
const lemonBtn = { ...btn, bgcolor: C.lemon, color: C.green, '&:hover': { bgcolor: C.lemonHover, boxShadow: 'none' } }
const greenBtn = { ...btn, bgcolor: C.green, color: '#fff', '&:hover': { bgcolor: C.green2, boxShadow: 'none' } }

/* ─── Content ─── */
const criteria = [
  { title: 'Online fee payment in Naira.', text: "Parents should be able to pay by card, transfer or USSD, with the money going into the school's own account, a receipt for every payment, and a clear view of who still owes." },
  { title: 'Works on an ordinary phone.', text: 'Teachers take registers and parents check results on everyday smartphones, often on weak networks. If it only works well on an office laptop, it will not get used.' },
  { title: 'Results the Nigerian way.', text: 'CA and exam scores, totals, class positions and averages, and report cards with teacher and principal remarks that look like the ones your parents already know.' },
  { title: 'One place for parents.', text: 'Attendance, fees, receipts and report cards on a single parent page, instead of scattered broadcast messages and lost printouts.' },
  { title: 'Clear pricing in Naira.', text: 'A price you can work out per student, per term, with a free trial long enough to prove it works in your school before you commit.' },
  { title: 'Your data, kept private.', text: "Each school's records kept apart from every other school's, access limited by role, and daily backups so nothing is lost." },
  { title: 'Help when you need it.', text: 'Setup help and a real person to talk to matter more than a long list of features you never switch on.' },
]

const vendorQuestions = [
  'Can parents pay online in Naira, and does the money go straight to our account?',
  'Does it work out totals, positions and report cards that match our format?',
  'Will teachers manage it on a basic smartphone and a weak network?',
  'What does it cost per term in Naira, and can we try it free first?',
  'Can each teacher see only their own classes?',
  'Can we import our existing student list from Excel?',
  'Who helps us set up, and how quickly do they reply?',
]

const steps = [
  { title: 'Register your school', text: 'School name, address and your owner account. You get a School ID straight away.' },
  { title: 'Add classes and subjects', text: 'From Nursery to SS 3, with capacities and class teachers.' },
  { title: 'Import your students', text: 'Upload your list from Excel; every student gets a profile.' },
  { title: 'Invite your team and go live', text: 'Teachers take registers today; parents see fees and pay online.' },
]

const faqs = [
  { q: 'What is the best school management software in Nigeria?', a: 'The best one is the one your staff will actually use every day. Judge any option against the checklist above: online fees in Naira into your own account, results and report cards in your format, ease of use on a phone, clear pricing, privacy and support. SchoolBricks is built around exactly those points, and you can try it free for 14 days to see if it fits.' },
  { q: 'How much does SchoolBricks cost?', a: '₦1,500 per active student, per term, with every feature included. A school with 300 students pays ₦450,000 a term. Students who have left or graduated are not counted.' },
  { q: 'What happens after the 14-day free trial?', a: 'You get an invoice for the current term, paid online with Paystack. There is then a 7-day grace period. If it is still unpaid after that, your school becomes read-only until payment: you can view and print everything, but not make changes. Nothing is ever deleted.' },
  { q: 'Do parents need to download an app?', a: 'No. Each family gets a parent page that opens in any phone browser, showing attendance, fees, payments and report cards. You can also send SMS through your own Termii account if you want.' },
  { q: 'How do parents pay fees?', a: "By card, bank transfer or USSD through Paystack, straight into your school's own Paystack account. Each payment is recorded and a receipt is issued." },
  { q: 'How do I move my school from paper or spreadsheets?', a: 'Create your classes, then import your students from an Excel or CSV file. Most schools are running within an afternoon, and our team can help you bring records across.' },
  { q: "Is my school's data secure?", a: "Yes. Each school's data is kept completely separate, access depends on each person's role, sign-in is protected against password guessing, and everything is backed up daily." },
  { q: 'Do text messages cost extra?', a: "Messages always appear free on the parent page. SMS is optional and goes through your school's own Termii account, so you pay Termii directly for the texts you send." },
]

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
  { label: 'Contact', href: '#contact' },
]

/* ─── Building blocks ─── */
function Logo({ dark = false, size = 'md' }: { dark?: boolean; size?: 'md' | 'lg' }) {
  const box = size === 'lg' ? 36 : 30
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ width: box, height: box, borderRadius: '9px', bgcolor: dark ? C.lemon : C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LogoIcon sx={{ fontSize: box * 0.56, color: dark ? C.green : '#fff' }} />
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: size === 'lg' ? '22px' : '17px', letterSpacing: '-0.3px', color: dark ? '#fff' : C.ink }}>
        School<Box component="span" sx={{ color: dark ? C.lemon : C.link }}>Bricks</Box>
      </Typography>
    </Stack>
  )
}

/** Inline link to a section on this page. */
function A({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Box component="a" href={href} sx={{ color: C.link, fontWeight: 700, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>{children}</Box>
  )
}

function H2({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <Typography id={id} component="h2" sx={{ fontWeight: 800, color: C.ink, fontSize: { xs: '1.6rem', md: '2.05rem' }, letterSpacing: '-0.8px', lineHeight: 1.2, mt: { xs: 6, md: 7.5 }, mb: 2, scrollMarginTop: '96px' }}>
      {children}
    </Typography>
  )
}

function P({ children, sx }: { children: ReactNode; sx?: object }) {
  return <Typography sx={{ color: C.body, fontSize: { xs: '1.02rem', md: '1.1rem' }, lineHeight: 1.8, mb: 2, ...sx }}>{children}</Typography>
}

const pill = {
  bgcolor: 'rgba(255,255,255,0.92)', backdropFilter: 'saturate(1.4) blur(14px)', WebkitBackdropFilter: 'saturate(1.4) blur(14px)',
  border: '1px solid rgba(16,36,28,0.08)', boxShadow: '0 6px 24px -10px rgba(4,24,18,0.35)', borderRadius: '999px',
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [studentCount, setStudentCount] = useState('300')
  const [contactForm, setContactForm] = useState({ name: '', email: '', school: '', message: '', website: '' })
  const [contactState, setContactState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  useEffect(() => {
    const previous = document.title
    document.title = 'SchoolBricks · School management software for Nigerian schools'
    return () => { document.title = previous }
  }, [])

  // The contact form goes to the same support inbox as the chat widget.
  const sendContact = async (e: React.FormEvent) => {
    e.preventDefault()
    setContactState('sending')
    try {
      await api.post('/support/messages', {
        name: contactForm.name.trim(),
        email: contactForm.email.trim(),
        message: (contactForm.school.trim() ? `School: ${contactForm.school.trim()}\n\n` : '') + contactForm.message.trim(),
        page: '/#contact',
        ...(contactForm.website ? { website: contactForm.website } : {}),
      })
      setContactState('sent')
      setContactForm({ name: '', email: '', school: '', message: '', website: '' })
    } catch {
      setContactState('error')
    }
  }

  return (
    // overflowX 'clip' (not 'hidden') keeps decorations from widening the page without breaking the fixed navbar.
    <Box sx={{
      width: '100%', overflowX: 'clip', bgcolor: C.cream, color: C.ink,
      '& .MuiTypography-root, & .MuiButton-root, & .MuiInputBase-root, & .MuiFormLabel-root, & .MuiAlert-message': { fontFamily: brand.font },
    }}>
      <GlobalStyles styles={{ html: { scrollBehavior: 'smooth' } }} />

      {/* ══════════════ Floating navbar ══════════════ */}
      <Box component="header" sx={{ position: 'fixed', top: { xs: 10, md: 14 }, left: 0, right: 0, zIndex: 1100, px: { xs: 1.5, md: 5 }, pointerEvents: 'none' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1.5} sx={{ '& > *': { pointerEvents: 'auto' } }}>
          <Box component="button" aria-label="SchoolBricks, back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            sx={{ all: 'unset', cursor: 'pointer', ...pill, px: { xs: 1.1, sm: 1.5 }, minWidth: 0, height: { xs: 46, md: 48 }, display: 'flex', alignItems: 'center', '&:focus-visible': { outline: `2px solid ${C.lemon}`, outlineOffset: 3 } }}>
            <Logo />
          </Box>

          <Box component="nav" aria-label="Main" sx={{ ...pill, display: { xs: 'none', md: 'flex' }, alignItems: 'center', height: 48, px: 1 }}>
            {navLinks.map((l) => (
              <Button key={l.label} href={l.href} sx={{ ...btn, fontWeight: 600, color: C.body, fontSize: '14px', px: 2, height: 38, whiteSpace: 'nowrap', '&:hover': { bgcolor: C.lemonSoft, color: C.green } }}>{l.label}</Button>
            ))}
          </Box>

          <Stack direction="row" spacing={{ xs: 0.75, sm: 1 }} alignItems="center" sx={{ flexShrink: 0 }}>
            <Button onClick={() => navigate('/login')} sx={{ ...btn, ...pill, display: { xs: 'none', sm: 'inline-flex' }, color: C.ink, fontSize: '14px', px: 2.25, height: 44, whiteSpace: 'nowrap', '&:hover': { bgcolor: '#fff' } }}>
              Sign in
            </Button>
            <Button variant="contained" onClick={() => navigate('/register')} endIcon={<ArrowIcon sx={{ fontSize: '17px !important' }} />}
              sx={{ ...lemonBtn, height: 44, px: { xs: 1.75, sm: 2.25 }, fontSize: '14px', whiteSpace: 'nowrap', boxShadow: '0 6px 20px -8px rgba(122,199,53,0.8)', '& .MuiButton-endIcon': { display: { xs: 'none', sm: 'inherit' } } }}>
              Get started
            </Button>
            <IconButton aria-label="Open menu" onClick={() => setMenuOpen(true)} sx={{ ...pill, display: { xs: 'inline-flex', md: 'none' }, width: 44, height: 44, color: C.ink, '&:hover': { bgcolor: '#fff' } }}>
              <MenuIcon />
            </IconButton>
          </Stack>
        </Stack>
      </Box>

      <Drawer anchor="right" open={menuOpen} onClose={() => setMenuOpen(false)}
        sx={{ display: { md: 'none' }, '& .MuiDrawer-paper': { width: '86%', maxWidth: 340, display: 'flex', flexDirection: 'column', bgcolor: C.cream }, '& .MuiTypography-root, & .MuiButton-root': { fontFamily: brand.font } }}>
        <Box sx={{ px: 2.5, height: 68, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: C.green }}>
          <Logo dark />
          <IconButton aria-label="Close menu" onClick={() => setMenuOpen(false)} sx={{ color: '#fff', width: 44, height: 44 }}><CloseIcon /></IconButton>
        </Box>
        <List sx={{ px: 1.5, py: 1.5, flex: 1 }}>
          {navLinks.map((l) => (
            <ListItemButton key={l.label} component="a" href={l.href} onClick={() => setMenuOpen(false)} sx={{ borderRadius: '12px', minHeight: 52 }}>
              <ListItemText primary={l.label} primaryTypographyProps={{ fontWeight: 700, fontSize: '1.05rem', color: C.ink, fontFamily: brand.font }} />
              <ArrowIcon sx={{ fontSize: 18, color: C.link }} />
            </ListItemButton>
          ))}
        </List>
        <Stack spacing={1.25} sx={{ p: 2.5, borderTop: `1px solid ${C.line}` }}>
          <Button fullWidth variant="contained" size="large" onClick={() => { setMenuOpen(false); navigate('/register') }} sx={{ ...lemonBtn, py: 1.4 }}>Start 14-day free trial</Button>
          <Button fullWidth variant="outlined" size="large" onClick={() => { setMenuOpen(false); navigate('/login') }} sx={{ ...btn, borderColor: C.line, color: C.green, py: 1.4, bgcolor: '#fff' }}>Sign in</Button>
        </Stack>
      </Drawer>

      {/* ══════════════ Hero ══════════════ */}
      <Box sx={{
        position: 'relative', color: '#fff', bgcolor: C.night,
        backgroundImage: `
          radial-gradient(ellipse 55% 80% at 15% 30%, rgba(122,199,53,0.13), rgba(122,199,53,0) 70%),
          radial-gradient(ellipse 45% 70% at 95% 0%, rgba(122,199,53,0.12), rgba(122,199,53,0) 70%),
          linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)`,
        backgroundSize: 'auto, auto, 48px 48px, 48px 48px',
      }}>
        <Container maxWidth="md" sx={{ pt: { xs: 13, md: 16 }, pb: { xs: 7, md: 9 } }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5, display: { xs: 'none', sm: 'flex' } }}>
            <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.65)' }}>SchoolBricks</Typography>
            <Typography sx={{ fontSize: '14px', color: 'rgba(255,255,255,0.35)' }}>/</Typography>
            <Typography sx={{ fontSize: '14px', color: '#fff' }}>School management software in Nigeria</Typography>
          </Stack>
          <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 2.5 }}>
            <Box sx={{ width: 30, height: 30, borderRadius: '9px', bgcolor: 'rgba(122,199,53,0.16)', border: '1px solid rgba(122,199,53,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GuideIcon sx={{ fontSize: 16, color: C.lemon }} />
            </Box>
            <Typography sx={{ fontSize: '13px', fontWeight: 800, letterSpacing: '2.5px', color: C.lemon, textTransform: 'uppercase' }}>2026 buyer's guide</Typography>
          </Stack>
          <Typography component="h1" sx={{ fontWeight: 800, fontSize: { xs: '2.35rem', sm: '3.1rem', md: '3.6rem' }, lineHeight: 1.06, letterSpacing: { xs: '-1.2px', md: '-2px' }, mb: 2.5, maxWidth: 720 }}>
            School management software built for{' '}
            <Box component="span" sx={{ color: C.lemon }}>Nigerian schools.</Box>
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.78)', fontSize: { xs: '1.02rem', md: '1.12rem' }, lineHeight: 1.75, maxWidth: 640, mb: 3.5 }}>
            Choosing a system touches your fees, your results and how parents see your school. This guide covers what really matters for a Nigerian school, the questions to ask any vendor, and how to start without risking your budget.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25}>
            <Button variant="contained" size="large" onClick={() => navigate('/register')} endIcon={<ArrowIcon />} sx={{ ...lemonBtn, height: 52, px: 3.25, fontSize: '1rem' }}>
              Start free for 14 days
            </Button>
            <Button size="large" href="#criteria" sx={{ ...btn, height: 52, px: 3.25, fontSize: '1rem', color: '#fff', border: '1px solid rgba(255,255,255,0.3)', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: '#fff' } }}>
              Read the guide
            </Button>
          </Stack>
        </Container>
      </Box>

      {/* ══════════════ Article ══════════════ */}
      <Box component="main">
        <Container maxWidth="md" sx={{ pt: { xs: 5, md: 7 }, pb: { xs: 8, md: 11 } }}>
          <Box sx={{ maxWidth: 770 }}>
            <P>
              Nigeria has a fast-growing choice of school management platforms, and they are not all built for the same kind of school. Instead of ranking vendors, this guide gives you a checklist to judge any option, including <A href="#where-schoolbricks-fits">SchoolBricks</A>, so you can choose what genuinely fits your school.
            </P>

            <H2 id="features">What school management software should do</H2>
            <P>
              At the very least, it should replace the notebooks, spreadsheets and broadcast groups with one connected system. That means <A href="#criteria">students and classes</A>, <A href="#criteria">attendance</A>, <A href="#criteria">fees and payments</A>, <A href="#criteria">results and report cards</A> and <A href="#criteria">parent communication</A>, all working from the same records, so you enter something once and it shows up everywhere.
            </P>
            <P>
              In SchoolBricks that includes daily registers with absence alerts, exam timetables and score entry with positions, printable report cards with remarks, fees and receipts, online payment with Paystack into your own account, a parent page for each family, class timetables with clash checks, and staff accounts where every teacher sees only their own classes.
            </P>

            <H2 id="criteria">What to look for (the criteria that matter in Nigeria)</H2>
            <Stack spacing={2.25} sx={{ mt: 1 }}>
              {criteria.map((c) => (
                <Stack key={c.title} direction="row" spacing={1.75} alignItems="flex-start">
                  <Box sx={{ width: 24, height: 24, borderRadius: '7px', bgcolor: C.lemonSoft, border: '1px solid #d5ecbd', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.4 }}>
                    <CheckIcon sx={{ fontSize: 15, color: C.lemonInk }} />
                  </Box>
                  <Typography sx={{ color: C.body, fontSize: { xs: '1rem', md: '1.06rem' }, lineHeight: 1.75 }}>
                    <Box component="strong" sx={{ color: C.ink, fontWeight: 800 }}>{c.title}</Box> {c.text}
                  </Typography>
                </Stack>
              ))}
            </Stack>

            <H2 id="questions">Questions to ask any vendor</H2>
            <Stack component="ul" spacing={1.4} sx={{ listStyle: 'none', p: 0, m: 0 }}>
              {vendorQuestions.map((q) => (
                <Stack component="li" key={q} direction="row" spacing={1.75} alignItems="flex-start">
                  <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: C.lemon, flexShrink: 0, mt: 1.2 }} />
                  <Typography sx={{ color: C.body, fontSize: { xs: '1rem', md: '1.06rem' }, lineHeight: 1.7 }}>{q}</Typography>
                </Stack>
              ))}
            </Stack>

            <H2 id="how-it-works">How to switch without the stress</H2>
            <P>Most schools move across in an afternoon. With SchoolBricks the steps are:</P>
            <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, borderRadius: '18px', bgcolor: '#fff', border: `1px solid ${C.line}`, overflow: 'hidden' }}>
              {steps.map((s, i) => (
                <Stack component="li" key={s.title} direction="row" spacing={2} alignItems="flex-start" sx={{ p: { xs: 2, md: 2.5 }, borderTop: i ? `1px solid ${C.line}` : 'none' }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: '10px', bgcolor: i === steps.length - 1 ? C.lemon : C.green, color: i === steps.length - 1 ? C.green : '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '0.95rem' }}>{i + 1}</Typography>
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 800, color: C.ink, fontSize: '1.02rem' }}>{s.title}</Typography>
                    <Typography sx={{ color: C.body, lineHeight: 1.65 }}>{s.text}</Typography>
                  </Box>
                </Stack>
              ))}
            </Box>

            <H2 id="pricing">What it should cost</H2>
            <P>
              Ask for a price in Naira that you can work out yourself, and a free trial before you pay anything. SchoolBricks costs <Box component="strong" sx={{ color: C.ink }}>₦1,500 per active student, per term</Box>, with every feature included, and starts with a 14-day free trial. No card is needed to start.
            </P>
            <Box sx={{
              p: { xs: 2.5, md: 3.5 }, borderRadius: '22px', color: '#fff', bgcolor: C.green, mt: 1,
              backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(122,199,53,0.3), rgba(122,199,53,0) 55%)',
            }}>
              <Grid container spacing={3} alignItems="center">
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ color: C.lemon, fontWeight: 800, letterSpacing: '2px', fontSize: '12px', textTransform: 'uppercase' }}>Work out your cost</Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mt: 1.5 }}>
                    <TextField
                      value={studentCount}
                      onChange={(e) => setStudentCount(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      inputProps={{ inputMode: 'numeric', 'aria-label': 'Number of students' }}
                      size="small"
                      sx={{ width: 120, '& .MuiOutlinedInput-root': { bgcolor: '#fff', borderRadius: '12px', fontWeight: 700 } }}
                    />
                    <Typography sx={{ color: 'rgba(255,255,255,0.88)' }}>students</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography sx={{ fontSize: { xs: '2rem', md: '2.4rem' }, fontWeight: 800, letterSpacing: '-1px', lineHeight: 1.1 }}>
                    ₦{(Number(studentCount || 0) * 1500).toLocaleString('en-NG')}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.75)' }}>per term, everything included</Typography>
                </Grid>
              </Grid>
            </Box>

            <H2 id="where-schoolbricks-fits">Where SchoolBricks fits</H2>
            <P>
              We build SchoolBricks around exactly the checklist above: online fees in Naira straight into your own Paystack account, report cards worked out for you, a design that works on everyday phones, a clear per-student price, and records kept private and backed up daily. If that matches what your school needs, start free and decide for yourself. If your priorities are different, use this guide to judge whichever option you consider.
            </P>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.5, sm: 3 }} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mt: 3 }}>
              <Button variant="contained" size="large" onClick={() => navigate('/register')} endIcon={<ArrowIcon />} sx={{ ...greenBtn, height: 52, px: 3.25, fontSize: '1rem' }}>
                Start free with SchoolBricks
              </Button>
              <Box component="a" href="#contact" sx={{ color: C.body, fontWeight: 600, textDecoration: 'none', textAlign: { xs: 'center', sm: 'left' }, '&:hover': { color: C.green } }}>
                Talk to us →
              </Box>
            </Stack>

            <H2 id="faq">Frequently asked questions</H2>
            <Stack spacing={1.25}>
              {faqs.map((f) => (
                <Accordion key={f.q} elevation={0} disableGutters
                  sx={{ borderRadius: '14px !important', border: `1px solid ${C.line}`, bgcolor: '#fff', boxShadow: '0 1px 2px rgba(16,36,28,0.04)', '&:before': { display: 'none' },
                    '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': { transform: 'rotate(45deg)' }, '&.Mui-expanded': { borderColor: '#cfe7b5' } }}>
                  <AccordionSummary expandIcon={<PlusIcon sx={{ color: C.link }} />} sx={{ px: { xs: 2, sm: 2.5 }, minHeight: 60 }}>
                    <Typography sx={{ fontWeight: 700, color: C.ink, fontSize: { xs: '0.98rem', md: '1.03rem' }, pr: 1 }}>{f.q}</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: { xs: 2, sm: 2.5 }, pt: 0, pb: 2.5 }}>
                    <Typography sx={{ color: C.body, lineHeight: 1.75 }}>{f.a}</Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Stack>

            <H2 id="contact">Talk to us</H2>
            <P>Questions, or want a free 30-minute walkthrough on Google Meet? Send us a message and we'll reply by email within one working day, or chat with us on WhatsApp.</P>
            <Box sx={{ p: { xs: 2.5, sm: 3.5 }, borderRadius: '20px', border: `1px solid ${C.line}`, bgcolor: '#fff' }}>
              {contactState === 'sent' && <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }}>Thank you! Your message has reached our team, and we'll reply to your email within one working day.</Alert>}
              {contactState === 'error' && <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>We couldn't send that just now. Please try again, or message us on WhatsApp.</Alert>}
              <Box component="form" onSubmit={sendContact}>
                {/* Hidden from people; bots tend to fill it in. */}
                <Box component="input" type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden value={contactForm.website}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setContactForm({ ...contactForm, website: e.target.value })}
                  sx={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Your name" required inputProps={{ maxLength: 100 }} value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Email" required type="email" inputProps={{ maxLength: 200 }} value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="School name" inputProps={{ maxLength: 120 }} value={contactForm.school} onChange={(e) => setContactForm({ ...contactForm, school: e.target.value })} />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Message" required multiline rows={4} inputProps={{ maxLength: 1800 }} value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} />
                  </Grid>
                  <Grid item xs={12}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <Button type="submit" variant="contained" size="large" disabled={contactState === 'sending'}
                        endIcon={contactState === 'sending' ? <CircularProgress size={18} sx={{ color: C.green }} /> : <SendIcon />}
                        sx={{ ...lemonBtn, px: 3.5, height: 50, '&.Mui-disabled': { bgcolor: C.lemonSoft, color: C.green } }}>
                        {contactState === 'sending' ? 'Sending…' : 'Send message'}
                      </Button>
                      <Button size="large" startIcon={<WhatsAppIcon />} href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hi SchoolBricks, I have a question.')}`} target="_blank" rel="noopener noreferrer"
                        sx={{ ...btn, height: 50, px: 3, color: C.green, border: `1px solid ${C.line}`, '&:hover': { bgcolor: C.lemonSoft } }}>
                        Chat on WhatsApp
                      </Button>
                    </Stack>
                  </Grid>
                </Grid>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      {/* ══════════════ Footer ══════════════ */}
      <Box component="footer" sx={{
        bgcolor: C.night, color: 'rgba(255,255,255,0.68)',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '22px 22px',
      }}>
        <Container maxWidth="lg" sx={{ pt: { xs: 6, md: 8 } }}>
          {/* Call to action card */}
          <Box sx={{ p: { xs: 2.75, md: 4 }, borderRadius: '22px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.12)', mb: { xs: 6, md: 8 } }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={7}>
                <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.25, py: 0.4, borderRadius: '999px', border: '1px solid rgba(122,199,53,0.4)', mb: 1.5 }}>
                  <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: C.lemon }} />
                  <Typography sx={{ fontSize: '11.5px', fontWeight: 800, letterSpacing: '2px', color: C.lemon, textTransform: 'uppercase' }}>14 days free</Typography>
                </Box>
                <Typography sx={{ fontWeight: 800, color: '#fff', fontSize: { xs: '1.45rem', md: '1.75rem' }, letterSpacing: '-0.5px', lineHeight: 1.25 }}>
                  Run your whole school from one calm dashboard.
                </Typography>
                <Typography sx={{ mt: 1, lineHeight: 1.7 }}>Fees, attendance, results and parents in one place. No card needed to start.</Typography>
              </Grid>
              <Grid item xs={12} md={5}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.25} justifyContent={{ md: 'flex-end' }}>
                  <Button variant="contained" size="large" onClick={() => navigate('/register')} endIcon={<ArrowIcon />} sx={{ ...lemonBtn, height: 50, px: 3 }}>Get started</Button>
                  <Button size="large" onClick={() => navigate('/login')} sx={{ ...btn, height: 50, px: 3, color: '#fff', border: '1px solid rgba(255,255,255,0.3)', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>Sign in</Button>
                </Stack>
              </Grid>
            </Grid>
          </Box>

          <Grid container spacing={4}>
            <Grid item xs={12} md={4.5}>
              <Logo dark size="lg" />
              <Typography sx={{ mt: 2, maxWidth: 340, lineHeight: 1.7, fontSize: '0.95rem' }}>
                The all-in-one platform for running a Nigerian school: fees, attendance, results and parents, in one calm place.
              </Typography>
              <Stack spacing={1.25} sx={{ mt: 3 }}>
                {[
                  { icon: <WhatsAppIcon />, text: 'Chat on WhatsApp', href: `https://wa.me/${WHATSAPP}` },
                  { icon: <PhoneIcon />, text: '0706 110 2797', href: 'tel:+2347061102797' },
                  { icon: <LocationIcon />, text: 'Lagos, Nigeria' },
                ].map((c) => (
                  <Stack key={c.text} direction="row" spacing={1.25} alignItems="center">
                    <Box sx={{ color: 'rgba(255,255,255,0.5)', display: 'flex', '& svg': { fontSize: 18 } }}>{c.icon}</Box>
                    {c.href ? (
                      <Typography component="a" href={c.href} target={c.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer" sx={{ color: 'inherit', textDecoration: 'none', fontSize: '0.95rem', '&:hover': { color: C.lemon } }}>{c.text}</Typography>
                    ) : (
                      <Typography sx={{ fontSize: '0.95rem' }}>{c.text}</Typography>
                    )}
                  </Stack>
                ))}
              </Stack>
            </Grid>
            {[
              { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'How it works', href: '#how-it-works' }, { label: 'Pricing', href: '#pricing' }, { label: 'FAQ', href: '#faq' }] },
              { title: 'Buyer’s guide', links: [{ label: 'What to look for', href: '#criteria' }, { label: 'Questions to ask', href: '#questions' }, { label: 'Where SchoolBricks fits', href: '#where-schoolbricks-fits' }] },
              { title: 'Company', links: [{ label: 'Contact', href: '#contact' }, { label: 'Sign in', href: '/login' }, { label: 'Register your school', href: '/register' }] },
            ].map((col) => (
              <Grid item xs={6} sm={4} md={2.5} key={col.title}>
                <Typography sx={{ fontWeight: 800, color: '#fff', mb: 1.75, fontSize: '0.82rem', letterSpacing: '1.5px', textTransform: 'uppercase' }}>{col.title}</Typography>
                <Stack spacing={{ xs: 0.25, md: 1.25 }}>
                  {col.links.map((l) => (
                    <Typography key={l.label} component="a" href={l.href} sx={{ color: 'inherit', textDecoration: 'none', fontSize: '0.95rem', py: { xs: 0.75, md: 0 }, '&:hover': { color: C.lemon } }}>{l.label}</Typography>
                  ))}
                </Stack>
              </Grid>
            ))}
          </Grid>
        </Container>
        <Box sx={{ borderTop: '1px solid rgba(255,255,255,0.08)', mt: { xs: 5, md: 7 } }}>
          <Container maxWidth="lg">
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1} sx={{ py: 3 }}>
              <Typography sx={{ fontSize: '0.88rem' }}>&copy; {new Date().getFullYear()} SchoolBricks. All rights reserved.</Typography>
              <Typography sx={{ fontSize: '0.88rem' }}>Built for the people who run Nigerian schools.</Typography>
            </Stack>
          </Container>
        </Box>
      </Box>
    </Box>
  )
}
