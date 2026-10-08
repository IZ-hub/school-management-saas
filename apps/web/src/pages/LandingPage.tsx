import { ReactNode, useState } from 'react'
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
  CheckCircle as CheckIcon,
  ArrowForward as ArrowIcon,
  Send as SendIcon,
  WhatsApp as WhatsAppIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  PaymentsOutlined as PaymentIcon,
  SmsOutlined as SmsIcon,
  LockOutlined as LockIcon,
  FlagOutlined as FlagIcon,
  PeopleOutlined as PeopleIcon,
  ArticleOutlined as ReportIcon,
  EventAvailableOutlined as AttendIcon,
  FamilyRestroomOutlined as ParentIcon,
  CalendarViewWeekOutlined as TimetableIcon,
  ExpandMore as ExpandMoreIcon,
  Videocam as VideocamIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  School as LogoIcon,
  FormatQuote as QuoteIcon,
} from '@mui/icons-material'
import { api } from '../lib/api'
import { Area, areas, brand } from '../theme'

/* ─── Palette for this page: the app's deep green and lemon ─── */
const C = {
  green: brand.green,
  green2: '#14523f',
  night: '#0a2a21',
  lemon: brand.lemon,
  lemonHover: brand.lemonHover,
  lemonSoft: brand.lemonSoft,
  lemonInk: brand.lemonInk,
  ink: brand.text,
  body: '#4a524b',
  muted: brand.muted,
  line: brand.border,
  cream: brand.page,
}

const WHATSAPP = '2347061102797'

/* Buttons: lemon always carries dark green text (6:1); never white on lemon. */
const btn = { textTransform: 'none', fontWeight: 700, borderRadius: '12px', boxShadow: 'none', '&:hover': { boxShadow: 'none' } } as const
const lemonBtn = { ...btn, bgcolor: C.lemon, color: C.green, '&:hover': { bgcolor: C.lemonHover, boxShadow: 'none' } }
const greenBtn = { ...btn, bgcolor: C.green, color: '#fff', '&:hover': { bgcolor: C.green2, boxShadow: 'none' } }
const ghostOnDark = { ...btn, border: '1px solid rgba(255,255,255,0.35)', color: '#fff', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)', borderColor: '#fff' } }

/* ─── Personas ─── */
const personas = [
  {
    role: 'The school owner',
    quote: 'Where did the money go? Who approved this?',
    pains: ["Can't see at a glance what has come in and what is still owed", 'End of term is weeks of chasing and reconciling'],
    fix: 'Fees collected vs expected on the dashboard, with every payment and receipt on record.',
  },
  {
    role: 'The teacher',
    quote: 'I became a teacher to teach, not to fill out forms.',
    pains: ['Registers on paper, copied out later (or lost)', 'Report card season means late nights with a calculator'],
    fix: 'A register in seconds on any phone, and report cards worked out for you.',
  },
  {
    role: 'The bursar',
    quote: "If one more parent says 'I already paid'…",
    pains: ['Payments scattered across receipts, bank apps and memory', 'No quick proof of what was paid, when, and by whom'],
    fix: 'Online payments land in your own account and are recorded the moment they clear.',
  },
]

/* ─── Feature tabs ─── */
const featureTabs = [
  {
    label: 'Setup',
    title: 'Your school, set up in minutes',
    desc: 'Add your school details, create classes and subjects, and import your students from Excel. No IT team needed: if you can use WhatsApp, you can set up SchoolBricks.',
    highlights: ['School profile, logo and motto', 'Classes, subjects and capacities', 'Your own term dates', 'Staff accounts by invitation'],
  },
  {
    label: 'Students',
    title: 'Every student, one complete record',
    desc: 'Enrol students, assign classes, take attendance, record results and keep parent contacts. Everything about a student lives on one profile, visible to the right people.',
    highlights: ['Student profiles and admission numbers', 'Daily attendance registers', 'Results and printable report cards', 'End-of-year promotion, with undo'],
  },
  {
    label: 'Fees',
    title: 'Know who owes and who paid, instantly',
    desc: 'Set fees per class and term, record payments, and let parents pay online with Paystack straight into your school’s own account. Every payment gets a receipt.',
    highlights: ['Fees by class and term, with discounts', 'Receipts for every payment', 'Online payment into your own account', 'Who owes, at a glance'],
  },
  {
    label: 'Team',
    title: 'Your team, their roles, your control',
    desc: 'Invite teachers, the principal and the bursar. Each person sees exactly what their role needs and nothing more: teachers only see their own classes.',
    highlights: ['Owner, principal, teacher and accountant roles', 'Teachers limited to their own classes', 'Reset links and instant sign-out', 'Login protection against guessing'],
  },
]

/* ─── Main features ─── */
const features: { area: Area; icon: ReactNode; title: string; desc: string }[] = [
  { area: 'attendance', icon: <AttendIcon />, title: 'Attendance', desc: 'Daily registers in seconds, with a two-week trend and absence alerts for parents.' },
  { area: 'exams', icon: <ReportIcon />, title: 'Exams & report cards', desc: 'Exam timetables, score entry, positions and printable report cards with remarks.' },
  { area: 'fees', icon: <PaymentIcon />, title: 'Fees & payments', desc: 'Fees per class and term, receipts, and Paystack payments into your own account.' },
  { area: 'students', icon: <PeopleIcon />, title: 'Students & staff', desc: 'Profiles, classes, Excel import, and staff accounts with the right permissions.' },
  { area: 'teachers', icon: <ParentIcon />, title: 'Parent page & messages', desc: 'Each family gets a page for attendance, fees and results, plus messages and optional SMS.' },
  { area: 'classes', icon: <TimetableIcon />, title: 'Timetables', desc: 'Build class timetables with automatic clash checks; teachers see their own week.' },
]

/* ─── What every school gets ─── */
const included = [
  'Students, classes, subjects and staff accounts',
  'Daily attendance registers, with absence alerts to parents',
  'Exam timetables, score entry and printable report cards',
  'Fees, receipts and online payment with Paystack into your own account',
  'A parent page for each family: attendance, fees and report cards',
  'Messages to parents on their page, with optional SMS',
  'Class timetables with clash checks',
  'Daily backups and secure, separate data for every school',
]

/* ─── "Built for Nigerian schools" values ─── */
const nigerianValues = [
  { title: 'Three terms, your dates.', desc: 'First, Second and Third term, with the dates your school actually uses.' },
  { title: 'Paystack built in.', desc: 'Parents pay by card, transfer or USSD, and the money goes straight to your school’s account.' },
  { title: 'No app for parents.', desc: 'Parents open their own page in any browser. Optional SMS through your own Termii account.' },
  { title: 'Your data stays private.', desc: "Each school's records are kept separate from every other school's, backed up daily, and handled in line with Nigeria's data-protection rules (NDPR)." },
  { title: 'Naira everywhere.', desc: 'Every fee, receipt and report in Naira. No conversions.' },
]

/* ─── FAQ data ─── */
const faqs = [
  { q: 'What types of schools is SchoolBricks for?', a: 'Nursery, primary and secondary schools in Nigeria, from a single campus with fifty pupils to large schools with thousands. Your classes, terms and fees are set up the way your school runs.' },
  { q: 'How long does setup take?', a: 'Most schools are ready in under 15 minutes: add your school details, create your classes, and import your student list from Excel.' },
  { q: 'Do parents need to download an app?', a: 'No. Each family gets its own parent page that opens in any phone browser, showing attendance, fees, payments and report cards. You can also send SMS through your own Termii account if you want.' },
  { q: 'How do parents pay fees?', a: "Parents pay by card, bank transfer or USSD through Paystack, directly into your school's own Paystack account. Each payment is recorded on its own and a receipt is issued." },
  { q: "Is my school's data secure?", a: "Yes. Each school's data is kept completely separate from every other school's, access depends on each person's role, sign-in is protected against password guessing, and everything is backed up daily." },
  { q: 'Can I move from another system or from Excel?', a: 'Yes. Import your students from an Excel or CSV file, and our team can help you bring your records across during setup.' },
  { q: 'How much does SchoolBricks cost?', a: '₦1,500 per active student, per term, with every feature included. A school with 300 students pays ₦450,000 a term. Students who have left or graduated are not counted.' },
  { q: 'What happens after the 14-day free trial?', a: 'You get an invoice for the current term, paid online with Paystack. There is then a 7-day grace period. If it is still unpaid after that, your school becomes read-only until payment: you can view and print everything, but not make changes. Nothing is ever deleted.' },
  { q: 'Do text messages cost extra?', a: "Messages to parents always appear free on their parent page. SMS is optional and goes through your school's own Termii account, so you pay Termii directly for the texts you send." },
]

const demoSteps = [
  { label: 'Register', title: 'Register your school', time: '2 minutes', desc: 'Enter your school name and address and create your owner account. You get a School ID straight away.', points: ['School name and address', 'Owner email and password', 'Your own term dates', 'Instant School ID'] },
  { label: 'Classes', title: 'Create your classes', time: '3 minutes', desc: 'Add each class, from Nursery 2 to SS 3, set its capacity and assign a class teacher.', points: ['Add classes and subjects', 'Set capacity', 'Assign class teachers', 'Any structure supported'] },
  { label: 'Students', title: 'Enrol your students', time: '5 minutes', desc: 'Upload your student list from Excel. Each student gets a profile with admission number, class and parent contacts. No retyping.', points: ['Excel or CSV import', 'Placed in their classes', 'Parent contacts stored', 'Profiles created instantly'] },
  { label: 'Live', title: "You're live", time: 'Today', desc: 'Teachers take registers today. Parents see fees on their page and pay online, and you see it the moment it clears.', points: ['Attendance from day one', 'Fees and online payment', 'Payments tracked as they clear', 'The right access for every role'] },
]

/* ─── Small building blocks ─── */
function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Box sx={{ width: 34, height: 34, borderRadius: '10px', bgcolor: dark ? C.lemon : C.green, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LogoIcon sx={{ fontSize: 19, color: dark ? C.green : '#fff' }} />
      </Box>
      <Typography sx={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.3px', color: dark ? '#fff' : C.ink }}>SchoolBricks</Typography>
    </Stack>
  )
}

function Eyebrow({ children, dark = false }: { children: ReactNode; dark?: boolean }) {
  return (
    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.5, borderRadius: '999px', bgcolor: dark ? 'rgba(122,199,53,0.16)' : C.lemonSoft, border: `1px solid ${dark ? 'rgba(122,199,53,0.35)' : '#d5ecbd'}`, mb: 2 }}>
      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: C.lemon }} />
      <Typography sx={{ fontSize: '12.5px', fontWeight: 700, letterSpacing: '0.3px', color: dark ? '#d9f0c2' : C.lemonInk }}>{children}</Typography>
    </Box>
  )
}

function SectionTitle({ eyebrow, title, sub, dark = false }: { eyebrow?: string; title: ReactNode; sub?: ReactNode; dark?: boolean }) {
  return (
    <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 }, maxWidth: 680, mx: 'auto' }}>
      {eyebrow && <Eyebrow dark={dark}>{eyebrow}</Eyebrow>}
      <Typography component="h2" sx={{ fontWeight: 800, color: dark ? '#fff' : C.ink, fontSize: { xs: '1.8rem', md: '2.6rem' }, letterSpacing: { xs: '-0.8px', md: '-1.2px' }, lineHeight: 1.15 }}>
        {title}
      </Typography>
      {sub && <Typography sx={{ color: dark ? 'rgba(255,255,255,0.75)' : C.muted, mt: 1.5, fontSize: { xs: '1rem', md: '1.08rem' }, lineHeight: 1.65 }}>{sub}</Typography>}
    </Box>
  )
}

function AreaBadge({ area, children, size = 44 }: { area: Area; children: ReactNode; size?: number }) {
  return (
    <Box sx={{ width: size, height: size, flexShrink: 0, borderRadius: '12px', bgcolor: areas[area].tint, color: areas[area].ink, display: 'flex', alignItems: 'center', justifyContent: 'center', '& svg': { fontSize: Math.round(size * 0.52) } }}>
      {children}
    </Box>
  )
}

/** A browser window frame for the product illustrations. */
function BrowserFrame({ url, children, shadow = true }: { url: string; children: ReactNode; shadow?: boolean }) {
  return (
    <Box sx={{ borderRadius: '16px', overflow: 'hidden', bgcolor: '#fff', border: '1px solid rgba(13,59,46,0.12)', boxShadow: shadow ? '0 30px 60px -20px rgba(4,24,18,0.45), 0 12px 24px -12px rgba(4,24,18,0.25)' : '0 8px 24px rgba(13,59,46,0.08)' }}>
      <Box sx={{ px: 1.5, py: 1, bgcolor: '#f3f2ec', borderBottom: `1px solid ${C.line}`, display: 'flex', alignItems: 'center', gap: 0.75 }}>
        {['#ff5f57', '#ffbd2e', '#28c840'].map((c) => <Box key={c} sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: c }} />)}
        <Box sx={{ flex: 1, ml: 1, px: 1.25, py: 0.25, bgcolor: '#fff', borderRadius: '6px', border: `1px solid ${C.line}` }}>
          <Typography sx={{ color: C.muted, fontSize: '0.65rem' }}>{url}</Typography>
        </Box>
      </Box>
      {children}
    </Box>
  )
}

/** A faithful miniature of the real dashboard: green banner, area tiles, lemon attendance bars and the fees ring. */
function DashboardMock() {
  const bars = [82, 88, 93, 79, 0, 91, 85, 89, 95, 84, 90, 96, 87, 92]
  const tiles: { area: Area; icon: ReactNode; label: string; value: string }[] = [
    { area: 'students', icon: <PeopleIcon />, label: 'Students', value: '486' },
    { area: 'teachers', icon: <PeopleIcon />, label: 'Teachers', value: '24' },
    { area: 'classes', icon: <TimetableIcon />, label: 'Classes', value: '14' },
    { area: 'attendance', icon: <AttendIcon />, label: 'Attendance', value: '94%' },
  ]
  return (
    <BrowserFrame url="schoolbricks · dashboard">
      <Box sx={{ display: 'flex', bgcolor: C.cream }}>
        <Box sx={{ width: 118, flexShrink: 0, bgcolor: '#fff', borderRight: `1px solid ${C.line}`, py: 1.5, px: 1, display: { xs: 'none', sm: 'block' } }}>
          {[['Dashboard', null], ['Students', 'students'], ['Teachers', 'teachers'], ['Classes', 'classes'], ['Attendance', 'attendance'], ['Exams', 'exams'], ['Fees', 'fees']].map(([item, area], i) => (
            <Stack key={item} direction="row" spacing={0.75} alignItems="center"
              sx={{ px: 0.75, py: 0.6, borderRadius: '6px', mb: 0.25, bgcolor: i === 0 ? C.lemonSoft : 'transparent', boxShadow: i === 0 ? `inset 2px 0 0 ${C.lemon}` : 'none' }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '2px', bgcolor: area ? areas[area as Area].solid : C.green }} />
              <Typography sx={{ fontSize: '0.62rem', fontWeight: i === 0 ? 700 : 500, color: i === 0 ? C.green : C.body }}>{item}</Typography>
            </Stack>
          ))}
        </Box>
        <Box sx={{ flex: 1, p: { xs: 1.25, sm: 1.5 }, minWidth: 0 }}>
          <Box sx={{ borderRadius: '10px', p: 1.25, mb: 1, bgcolor: C.green, backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(122,199,53,0.4), rgba(122,199,53,0) 60%)' }}>
            <Typography sx={{ fontSize: '0.55rem', color: C.lemon, fontWeight: 700 }}>Monday, 12 January</Typography>
            <Typography sx={{ fontSize: '0.85rem', color: '#fff', fontWeight: 800 }}>Good morning, Mrs Adeyemi</Typography>
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.75 }}>
              <Box sx={{ px: 0.9, py: 0.3, borderRadius: '999px', bgcolor: C.lemon }}><Typography sx={{ fontSize: '0.52rem', fontWeight: 700, color: C.green }}>Take attendance</Typography></Box>
              <Box sx={{ px: 0.9, py: 0.3, borderRadius: '999px', border: '1px solid rgba(255,255,255,0.3)' }}><Typography sx={{ fontSize: '0.52rem', fontWeight: 700, color: '#fff' }}>Record payment</Typography></Box>
            </Stack>
          </Box>
          <Grid container spacing={0.75}>
            {tiles.map((t) => (
              <Grid item xs={6} sm={3} key={t.label}>
                <Box sx={{ p: 0.9, borderRadius: '8px', bgcolor: '#fff', border: `1px solid ${C.line}` }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: '0.5rem', color: C.muted, fontWeight: 600 }}>{t.label}</Typography>
                    <AreaBadge area={t.area} size={16}>{t.icon}</AreaBadge>
                  </Stack>
                  <Typography sx={{ fontSize: '0.95rem', fontWeight: 800, color: C.ink, lineHeight: 1.3 }}>{t.value}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
          <Grid container spacing={0.75} sx={{ mt: 0 }}>
            <Grid item xs={12} sm={8}>
              <Box sx={{ p: 1, borderRadius: '8px', bgcolor: '#fff', border: `1px solid ${C.line}`, height: '100%' }}>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: C.ink, mb: 0.75 }}>Attendance · last 2 weeks</Typography>
                <Stack direction="row" alignItems="flex-end" sx={{ height: 58, gap: '3px' }}>
                  {bars.map((v, i) => (
                    <Box key={i} sx={{ flex: 1, height: v ? `${v}%` : '2px', bgcolor: v ? (i === 11 ? brand.lemonDeep : C.lemon) : '#dcd9cf', borderRadius: '2px 2px 0 0' }} />
                  ))}
                </Stack>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4} sx={{ display: { xs: 'none', sm: 'block' } }}>
              <Box sx={{ p: 1, borderRadius: '8px', bgcolor: '#fff', border: `1px solid ${C.line}`, height: '100%', textAlign: 'center' }}>
                <Typography sx={{ fontSize: '0.55rem', fontWeight: 700, color: C.ink, mb: 0.5, textAlign: 'left' }}>Fees this term</Typography>
                <Box sx={{ position: 'relative', width: 56, height: 56, mx: 'auto' }}>
                  <svg viewBox="0 0 56 56" width="56" height="56" aria-hidden>
                    <circle cx="28" cy="28" r="22" fill="none" stroke={areas.fees.tint} strokeWidth="7" />
                    <circle cx="28" cy="28" r="22" fill="none" stroke={areas.fees.solid} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${0.72 * 138.2} 138.2`} transform="rotate(-90 28 28)" />
                  </svg>
                  <Typography sx={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: C.ink }}>72%</Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </BrowserFrame>
  )
}

/** Small floating notification cards around the hero illustration. */
function FloatCard({ icon, area, title, sub, sx }: { icon: ReactNode; area: Area; title: string; sub: string; sx: object }) {
  return (
    <Box sx={{
      position: 'absolute', zIndex: 2, display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1.25, px: 1.5, py: 1.1,
      bgcolor: '#fff', borderRadius: '14px', boxShadow: '0 18px 40px -12px rgba(4,24,18,0.45)',
      animation: 'sbFloat 6s ease-in-out infinite', '@media (prefers-reduced-motion: reduce)': { animation: 'none' }, ...sx,
    }}>
      <AreaBadge area={area} size={34}>{icon}</AreaBadge>
      <Box>
        <Typography sx={{ fontSize: '13px', fontWeight: 700, color: C.ink, lineHeight: 1.3 }}>{title}</Typography>
        <Typography sx={{ fontSize: '12px', color: C.muted }}>{sub}</Typography>
      </Box>
    </Box>
  )
}

/** Sidebar used inside the demo step illustrations. */
function MiniSidebar({ items, active }: { items: string[]; active: number }) {
  return (
    <Box sx={{ width: 130, flexShrink: 0, bgcolor: '#fff', borderRight: `1px solid ${C.line}`, py: 2, px: 1.25, display: { xs: 'none', sm: 'block' } }}>
      <Box sx={{ mb: 1.5, px: 0.5 }}><Typography sx={{ fontSize: '0.72rem', fontWeight: 800, color: C.green }}>SchoolBricks</Typography></Box>
      {items.map((item, i) => (
        <Box key={item} sx={{ px: 1, py: 0.6, borderRadius: '6px', mb: 0.25, bgcolor: i === active ? C.lemonSoft : 'transparent', boxShadow: i === active ? `inset 2px 0 0 ${C.lemon}` : 'none' }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: i === active ? 700 : 500, color: i === active ? C.green : C.body }}>{item}</Typography>
        </Box>
      ))}
    </Box>
  )
}

/* Offset for in-page anchors so the sticky navbar doesn't cover section headings */
const anchorOffset = { scrollMarginTop: { xs: '72px', md: '84px' } }

export default function LandingPage() {
  const navigate = useNavigate()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [demoStep, setDemoStep] = useState(0)
  const [studentCount, setStudentCount] = useState('300')
  const [contactForm, setContactForm] = useState({ name: '', email: '', school: '', message: '', website: '' })
  const [contactState, setContactState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'How it works', href: '#demo' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'FAQ', href: '#faq' },
    { label: 'Contact', href: '#contact' },
  ]

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

  const tab = featureTabs[activeTab]
  const step = demoSteps[demoStep]

  return (
    // overflowX 'clip' (not 'hidden') keeps decorative shapes from widening the page
    // without turning this box into a scroll container, which would break the sticky navbar.
    <Box sx={{
      width: '100%', overflowX: 'clip', bgcolor: '#fff', color: C.ink,
      '& .MuiTypography-root, & .MuiButton-root, & .MuiInputBase-root, & .MuiFormLabel-root, & .MuiAlert-message': { fontFamily: brand.font },
    }}>
      <GlobalStyles styles={{
        html: { scrollBehavior: 'smooth' },
        '@keyframes sbFloat': { '0%, 100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        '@keyframes sbFade': { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
      }} />

      {/* ══════════════ Navbar ══════════════ */}
      <Box component="nav" aria-label="Main" sx={{ position: 'sticky', top: 0, zIndex: 1100, bgcolor: 'rgba(255,255,255,0.9)', backdropFilter: 'saturate(1.4) blur(12px)', WebkitBackdropFilter: 'saturate(1.4) blur(12px)', borderBottom: `1px solid ${C.line}` }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ height: { xs: 60, md: 70 } }}>
            <Box component="button" aria-label="SchoolBricks, back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} sx={{ all: 'unset', cursor: 'pointer', '&:focus-visible': { outline: `2px solid ${C.lemon}`, outlineOffset: 4, borderRadius: '8px' } }}>
              <Logo />
            </Box>

            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
              {navLinks.map((link) => (
                <Button key={link.label} href={link.href} sx={{ color: C.body, textTransform: 'none', fontWeight: 600, fontSize: '14.5px', px: 1.5, whiteSpace: 'nowrap', '&:hover': { color: C.green, bgcolor: C.lemonSoft } }}>{link.label}</Button>
              ))}
              <Box sx={{ width: '1px', height: 24, bgcolor: C.line, mx: 1 }} />
              <Button onClick={() => navigate('/login')} sx={{ color: C.green, textTransform: 'none', fontWeight: 700, fontSize: '14.5px', px: 1.5, whiteSpace: 'nowrap' }}>Sign in</Button>
              <Button variant="contained" onClick={() => navigate('/register')} sx={{ ...lemonBtn, px: 2.5, height: 42, fontSize: '14.5px', whiteSpace: 'nowrap' }}>
                Start free trial
              </Button>
            </Stack>

            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: { xs: 'flex', md: 'none' } }}>
              <Button variant="contained" onClick={() => navigate('/register')} sx={{ ...lemonBtn, height: 40, px: 2, fontSize: '14px', whiteSpace: 'nowrap' }}>
                Start free
              </Button>
              <IconButton aria-label="Open menu" onClick={() => setMobileMenuOpen(true)} sx={{ color: C.ink, width: 44, height: 44 }}>
                <MenuIcon />
              </IconButton>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* Mobile navigation drawer */}
      <Drawer
        anchor="right"
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        sx={{ display: { md: 'none' }, '& .MuiDrawer-paper': { width: '86%', maxWidth: 340, display: 'flex', flexDirection: 'column' }, '& .MuiTypography-root, & .MuiButton-root': { fontFamily: brand.font } }}
      >
        <Box sx={{ px: 2.5, height: 64, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: C.green }}>
          <Logo dark />
          <IconButton aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} sx={{ color: '#fff', width: 44, height: 44 }}><CloseIcon /></IconButton>
        </Box>
        <List sx={{ px: 1.5, py: 1.5, flex: 1 }}>
          {navLinks.map((link) => (
            <ListItemButton key={link.label} component="a" href={link.href} onClick={() => setMobileMenuOpen(false)} sx={{ borderRadius: '12px', minHeight: 52 }}>
              <ListItemText primary={link.label} primaryTypographyProps={{ fontWeight: 700, fontSize: '1.05rem', color: C.ink, fontFamily: brand.font }} />
              <ArrowIcon sx={{ fontSize: 18, color: C.lemon }} />
            </ListItemButton>
          ))}
        </List>
        <Stack spacing={1.25} sx={{ p: 2.5, borderTop: `1px solid ${C.line}` }}>
          <Button fullWidth variant="contained" size="large" onClick={() => { setMobileMenuOpen(false); navigate('/register') }} sx={{ ...lemonBtn, py: 1.4 }}>
            Start 14-day free trial
          </Button>
          <Button fullWidth variant="outlined" size="large" onClick={() => { setMobileMenuOpen(false); navigate('/login') }} sx={{ ...btn, borderColor: C.line, color: C.green, py: 1.4 }}>
            Sign in
          </Button>
        </Stack>
      </Drawer>

      {/* ══════════════ Hero ══════════════ */}
      <Box sx={{
        position: 'relative', overflow: 'hidden', bgcolor: C.green, color: '#fff',
        backgroundImage: `
          radial-gradient(ellipse 60% 70% at 85% 10%, rgba(122,199,53,0.28), rgba(122,199,53,0) 70%),
          radial-gradient(ellipse 50% 60% at 0% 100%, rgba(122,199,53,0.12), rgba(122,199,53,0) 70%),
          linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)`,
        backgroundSize: 'auto, auto, 44px 44px, 44px 44px',
      }}>
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, pt: { xs: 5, md: 10 }, pb: { xs: 6, md: 11 } }}>
          <Grid container spacing={{ xs: 5, md: 6 }} alignItems="center">
            <Grid item xs={12} md={5.5}>
              <Eyebrow dark>Built for Nigerian schools</Eyebrow>
              <Typography component="h1" sx={{ fontWeight: 800, fontSize: { xs: '2.4rem', sm: '3.1rem', md: '3.3rem', lg: '3.5rem' }, lineHeight: 1.06, letterSpacing: { xs: '-1.2px', md: '-2px' }, mb: { xs: 2, md: 2.5 } }}>
                Run your whole school from{' '}
                <Box component="span" sx={{ color: C.lemon, whiteSpace: { sm: 'nowrap' } }}>one calm dashboard.</Box>
              </Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.82)', fontSize: { xs: '1.02rem', md: '1.15rem' }, lineHeight: 1.7, mb: { xs: 3, md: 4 }, maxWidth: 470 }}>
                Attendance, results and report cards, fees and online payments, timetables and parent messages, all connected and all in Naira.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.25, sm: 1.5 }} sx={{ mb: 3.5 }}>
                <Button variant="contained" size="large" onClick={() => navigate('/register')} endIcon={<ArrowIcon />} sx={{ ...lemonBtn, px: 3.5, height: 54, fontSize: '1rem' }}>
                  Start your free trial
                </Button>
                <Button variant="outlined" size="large" href="#demo" sx={{ ...ghostOnDark, px: 3.5, height: 54, fontSize: '1rem' }}>
                  See how it works
                </Button>
              </Stack>
              <Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 2.5, rowGap: 1 }}>
                {['14 days free', 'No card needed', 'Set up in 15 minutes'].map((b) => (
                  <Stack direction="row" spacing={0.75} alignItems="center" key={b}>
                    <CheckIcon sx={{ fontSize: 18, color: C.lemon }} />
                    <Typography sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '14.5px', fontWeight: 500 }}>{b}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>

            <Grid item xs={12} md={6.5}>
              <Box sx={{ position: 'relative', px: { md: 2 } }}>
                <DashboardMock />
                <FloatCard area="fees" icon={<PaymentIcon />} title="₦45,000 received" sub="Paystack · JSS 2B fees" sx={{ left: -16, bottom: -26 }} />
                <FloatCard area="attendance" icon={<AttendIcon />} title="SS 1A register taken" sub="38 of 40 present" sx={{ right: -20, top: -22, animationDelay: '1.5s' }} />
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ Trust strip ══════════════ */}
      <Box sx={{ py: { xs: 2.5, md: 3 }, borderBottom: `1px solid ${C.line}`, bgcolor: '#fff' }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, auto)' }, justifyContent: { md: 'space-between' }, columnGap: { xs: 1.5, md: 4 }, rowGap: 1.75 }}>
            {[
              { icon: <FlagIcon />, label: 'Built for Nigerian schools' },
              { icon: <PaymentIcon />, label: 'Paystack into your own account' },
              { icon: <SmsIcon />, label: 'SMS through your own Termii' },
              { icon: <LockIcon />, label: 'Private, backed up daily' },
            ].map((badge) => (
              <Stack key={badge.label} direction="row" spacing={1} alignItems="center">
                <Box sx={{ width: 28, height: 28, borderRadius: '8px', bgcolor: C.lemonSoft, color: C.lemonInk, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, '& svg': { fontSize: 16 } }}>{badge.icon}</Box>
                <Typography sx={{ color: C.body, fontWeight: 600, fontSize: { xs: '0.8rem', md: '0.9rem' }, lineHeight: 1.3 }}>{badge.label}</Typography>
              </Stack>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ══════════════ Features grid ══════════════ */}
      <Box sx={{ py: { xs: 7, md: 12 }, bgcolor: C.cream }}>
        <Container maxWidth="lg">
          <SectionTitle eyebrow="Everything in one place" title="Everything your school runs on" sub="Six parts that work together, so a payment, a register or a result shows up everywhere it should." />
          <Grid container spacing={{ xs: 1.5, sm: 2.5 }}>
            {features.map((f) => (
              <Grid item xs={12} sm={6} md={4} key={f.title}>
                <Box sx={{
                  p: { xs: 2.25, sm: 3 }, height: '100%', borderRadius: '18px', bgcolor: '#fff', border: `1px solid ${C.line}`,
                  display: { xs: 'flex', sm: 'block' }, gap: 2, alignItems: 'flex-start',
                  transition: 'box-shadow 0.2s, transform 0.2s, border-color 0.2s',
                  '&:hover': { boxShadow: '0 14px 34px -14px rgba(13,59,46,0.25)', transform: { md: 'translateY(-3px)' }, borderColor: areas[f.area].solid },
                }}>
                  <Box sx={{ mb: { xs: 0, sm: 2.25 } }}><AreaBadge area={f.area} size={48}>{f.icon}</AreaBadge></Box>
                  <Box>
                    <Typography component="h3" sx={{ fontWeight: 800, color: C.ink, mb: 0.75, fontSize: { xs: '1.02rem', sm: '1.12rem' } }}>{f.title}</Typography>
                    <Typography sx={{ color: C.body, lineHeight: 1.65, fontSize: '0.94rem' }}>{f.desc}</Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ Personas ══════════════ */}
      <Box sx={{ py: { xs: 7, md: 12 } }}>
        <Container maxWidth="lg">
          <SectionTitle eyebrow="Who it's for" title="Every school runs on these three people" sub="And every term, they hit the same problems. Here's what changes for each of them." />
          <Grid container spacing={{ xs: 2, md: 3 }}>
            {personas.map((p) => (
              <Grid item xs={12} md={4} key={p.role}>
                <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', borderRadius: '20px', border: `1px solid ${C.line}`, overflow: 'hidden', bgcolor: '#fff' }}>
                  <Box sx={{ p: { xs: 2.5, md: 3 }, flex: 1 }}>
                    <Typography sx={{ color: C.lemonInk, fontWeight: 800, fontSize: '12.5px', letterSpacing: '1.5px', textTransform: 'uppercase', mb: 1.5 }}>{p.role}</Typography>
                    <QuoteIcon sx={{ color: C.lemon, fontSize: 30, transform: 'scaleX(-1)', mb: 0.5 }} />
                    <Typography sx={{ fontWeight: 800, color: C.ink, fontSize: { xs: '1.2rem', md: '1.3rem' }, lineHeight: 1.35, mb: 2 }}>{p.quote}</Typography>
                    <Stack spacing={1}>
                      {p.pains.map((pain) => (
                        <Stack direction="row" spacing={1.25} key={pain} alignItems="flex-start">
                          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#c9c6bb', mt: 1, flexShrink: 0 }} />
                          <Typography sx={{ color: C.body, lineHeight: 1.6, fontSize: '0.94rem' }}>{pain}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                  <Box sx={{ px: { xs: 2.5, md: 3 }, py: 2, bgcolor: C.lemonSoft, borderTop: '1px solid #dcefc8' }}>
                    <Stack direction="row" spacing={1.25} alignItems="flex-start">
                      <CheckIcon sx={{ fontSize: 20, color: brand.lemonDeep, mt: 0.15, flexShrink: 0 }} />
                      <Typography sx={{ color: C.green, fontWeight: 600, lineHeight: 1.55, fontSize: '0.94rem' }}>{p.fix}</Typography>
                    </Stack>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ Features (Tabbed) ══════════════ */}
      <Box id="features" sx={{ py: { xs: 7, md: 12 }, bgcolor: C.cream, ...anchorOffset }}>
        <Container maxWidth="lg">
          <SectionTitle eyebrow="Features" title="Built around how a school day really works" />
          <Box role="tablist" aria-label="Features" sx={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 0.5, p: 0.5, mb: { xs: 3.5, md: 6 }, mx: 'auto', maxWidth: 560,
            bgcolor: '#fff', border: `1px solid ${C.line}`, borderRadius: '14px',
          }}>
            {featureTabs.map((t, i) => (
              <Button key={t.label} role="tab" aria-selected={activeTab === i} onClick={() => setActiveTab(i)}
                sx={{ ...btn, borderRadius: '10px', height: 42, fontSize: { xs: '0.85rem', sm: '0.92rem' }, minWidth: 0, px: 0.5,
                  bgcolor: activeTab === i ? C.green : 'transparent', color: activeTab === i ? '#fff' : C.body,
                  '&:hover': { bgcolor: activeTab === i ? C.green2 : C.lemonSoft } }}>
                {t.label}
              </Button>
            ))}
          </Box>

          <Grid container spacing={{ xs: 0, md: 7 }} alignItems="center" key={activeTab} sx={{ animation: 'sbFade 0.35s ease', '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}>
            {/* Illustration repeats the text beside it, so it's hidden on phones */}
            <Grid item xs={12} md={6} sx={{ display: { xs: 'none', md: 'block' } }}>
              <BrowserFrame url={`schoolbricks · ${tab.label.toLowerCase()}`} shadow={false}>
                <Box sx={{ p: 3.5, bgcolor: C.cream, minHeight: 300 }}>
                  <Typography sx={{ color: C.lemonInk, fontWeight: 800, fontSize: '12px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>0{activeTab + 1} · {tab.label}</Typography>
                  <Typography sx={{ fontWeight: 800, color: C.ink, mb: 2.5, mt: 0.5, fontSize: '1.15rem' }}>{tab.title}</Typography>
                  <Grid container spacing={1.5}>
                    {tab.highlights.map((h, i) => (
                      <Grid item xs={6} key={h}>
                        <Box sx={{ p: 1.75, borderRadius: '12px', border: `1px solid ${C.line}`, bgcolor: '#fff', height: '100%' }}>
                          <Box sx={{ width: 26, height: 26, borderRadius: '8px', bgcolor: i === 0 ? C.lemon : C.lemonSoft, color: C.green, display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800 }}>{i + 1}</Typography>
                          </Box>
                          <Typography sx={{ fontWeight: 700, color: C.ink, fontSize: '0.86rem', lineHeight: 1.4 }}>{h}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </BrowserFrame>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography sx={{ color: C.lemonInk, fontWeight: 800, fontSize: '13px', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
                Step 0{activeTab + 1}
              </Typography>
              <Typography component="h3" sx={{ fontWeight: 800, color: C.ink, mt: 1, mb: 2, fontSize: { xs: '1.55rem', md: '2.1rem' }, letterSpacing: '-0.6px', lineHeight: 1.2 }}>
                {tab.title}
              </Typography>
              <Typography sx={{ color: C.body, lineHeight: 1.8, mb: 3, fontSize: '1.02rem' }}>{tab.desc}</Typography>
              <Stack spacing={1.5}>
                {tab.highlights.map((h) => (
                  <Stack direction="row" spacing={1.5} key={h} alignItems="center">
                    <CheckIcon sx={{ fontSize: 20, color: C.lemon }} />
                    <Typography sx={{ color: C.ink, fontWeight: 600, fontSize: '0.96rem' }}>{h}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ Pricing ══════════════ */}
      <Box id="pricing" sx={{ py: { xs: 7, md: 12 }, ...anchorOffset }}>
        <Container maxWidth="lg">
          <SectionTitle eyebrow="Pricing" title="Simple pricing. No surprises." sub="One price with every feature included. You only pay for students who are actually enrolled." />

          <Box sx={{ maxWidth: 960, mx: 'auto', borderRadius: '24px', overflow: 'hidden', border: `1px solid ${C.line}`, boxShadow: '0 30px 60px -30px rgba(13,59,46,0.3)' }}>
            <Grid container>
              <Grid item xs={12} md={6} sx={{
                p: { xs: 3, md: 5 }, bgcolor: C.green, color: '#fff',
                backgroundImage: 'radial-gradient(circle at 100% 0%, rgba(122,199,53,0.3), rgba(122,199,53,0) 55%)',
              }}>
                <Typography sx={{ color: C.lemon, fontWeight: 800, letterSpacing: '1.5px', fontSize: '12.5px', textTransform: 'uppercase' }}>Per student, per term</Typography>
                <Typography sx={{ fontSize: { xs: '3rem', md: '4rem' }, fontWeight: 800, letterSpacing: '-2px', lineHeight: 1.1, mt: 0.5 }}>₦1,500</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.78)', mb: 3.5 }}>for each active student, billed at the start of each term.</Typography>

                <Box sx={{ p: 2, borderRadius: '16px', bgcolor: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.88)', fontWeight: 700, mb: 1.25, fontSize: '0.92rem' }}>Work out your cost</Typography>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                    <TextField
                      value={studentCount}
                      onChange={(e) => setStudentCount(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      inputProps={{ inputMode: 'numeric', 'aria-label': 'Number of students' }}
                      size="small"
                      sx={{ width: 120, '& .MuiOutlinedInput-root': { bgcolor: '#fff', borderRadius: '10px', fontWeight: 700 } }}
                    />
                    <Typography sx={{ color: 'rgba(255,255,255,0.88)' }}>students</Typography>
                  </Stack>
                  <Typography sx={{ fontSize: '1.6rem', fontWeight: 800, color: '#fff' }}>
                    ₦{(Number(studentCount || 0) * 1500).toLocaleString('en-NG')}{' '}
                    <Box component="span" sx={{ fontSize: '0.95rem', fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>per term</Box>
                  </Typography>
                </Box>

                <Button variant="contained" size="large" fullWidth onClick={() => navigate('/register')} endIcon={<ArrowIcon />} sx={{ ...lemonBtn, mt: 3, height: 52, fontSize: '1rem' }}>
                  Start 14-day free trial
                </Button>
                <Typography sx={{ color: 'rgba(255,255,255,0.7)', mt: 1.25, fontSize: '0.88rem', textAlign: 'center' }}>No card needed to start.</Typography>
              </Grid>
              <Grid item xs={12} md={6} sx={{ p: { xs: 3, md: 5 }, bgcolor: '#fff' }}>
                <Typography sx={{ fontWeight: 800, color: C.ink, mb: 2.5, fontSize: '1.1rem' }}>Everything is included</Typography>
                <Stack spacing={1.5}>
                  {included.map((f) => (
                    <Stack key={f} direction="row" spacing={1.25} alignItems="flex-start">
                      <Box sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: C.lemon, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, mt: 0.15 }}>
                        <CheckIcon sx={{ fontSize: 14, color: C.green }} />
                      </Box>
                      <Typography sx={{ color: C.body, lineHeight: 1.55, fontSize: '0.95rem' }}>{f}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </Container>
      </Box>

      {/* ══════════════ Built for Nigerian schools ══════════════ */}
      <Box sx={{ py: { xs: 7, md: 11 }, bgcolor: C.night }}>
        <Container maxWidth="lg">
          <SectionTitle dark eyebrow="Made here" title="Built for how Nigerian schools actually work" />
          <Grid container spacing={{ xs: 1.5, sm: 2 }}>
            {nigerianValues.map((v, idx) => (
              <Grid item xs={12} sm={6} md={idx < 3 ? 4 : 6} key={v.title}>
                <Box sx={{ p: { xs: 2.5, sm: 3 }, borderRadius: '18px', bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', height: '100%', transition: 'border-color 0.2s', '&:hover': { borderColor: 'rgba(122,199,53,0.5)' } }}>
                  <Box sx={{ width: 28, height: 4, borderRadius: 2, bgcolor: C.lemon, mb: 2 }} />
                  <Typography sx={{ fontWeight: 800, color: '#fff', mb: 1, fontSize: '1.05rem' }}>{v.title}</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.72)', lineHeight: 1.7, fontSize: '0.94rem' }}>{v.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ Demo — Interactive Setup ══════════════ */}
      <Box id="demo" sx={{ py: { xs: 7, md: 12 }, ...anchorOffset }}>
        <Container maxWidth="lg">
          <SectionTitle eyebrow="How it works" title="From sign-up to fully running in 4 steps" sub="Click through each step to see how SchoolBricks gets your school ready." />

          {/* Numbered stepper */}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: { xs: 0.75, sm: 1.5 }, mb: { xs: 3.5, md: 5 }, maxWidth: 720, mx: 'auto' }}>
            {demoSteps.map((s, i) => {
              const done = i < demoStep, on = i === demoStep
              return (
                <Box key={s.label} component="button" onClick={() => setDemoStep(i)} aria-current={on ? 'step' : undefined}
                  sx={{ all: 'unset', cursor: 'pointer', textAlign: 'center', '&:focus-visible > div:first-of-type': { outline: `2px solid ${C.lemon}`, outlineOffset: 2 } }}>
                  <Box sx={{ height: 5, borderRadius: 3, bgcolor: on || done ? C.lemon : C.line, mb: 1.25, transition: 'background-color 0.2s' }} />
                  <Typography sx={{ fontSize: { xs: '0.78rem', sm: '0.9rem' }, fontWeight: on ? 800 : 600, color: on ? C.green : C.muted }}>
                    {i + 1}. {s.label}
                  </Typography>
                </Box>
              )
            })}
          </Box>

          <Grid container spacing={{ xs: 3.5, md: 6 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Box key={demoStep} sx={{ animation: 'sbFade 0.35s ease', '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                  <Box sx={{ width: 44, height: 44, borderRadius: '12px', bgcolor: C.lemon, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ fontWeight: 800, color: C.green }}>0{demoStep + 1}</Typography>
                  </Box>
                  <Box>
                    <Typography component="h3" sx={{ fontWeight: 800, color: C.ink, lineHeight: 1.2, fontSize: '1.3rem' }}>{step.title}</Typography>
                    <Typography sx={{ color: C.muted, fontSize: '0.88rem' }}>{step.time}</Typography>
                  </Box>
                </Stack>
                <Typography sx={{ color: C.body, lineHeight: 1.75, mb: 2.5 }}>{step.desc}</Typography>
                <Stack spacing={1.1}>
                  {step.points.map((p) => (
                    <Stack direction="row" spacing={1.25} alignItems="center" key={p}>
                      <CheckIcon sx={{ fontSize: 19, color: C.lemon }} />
                      <Typography sx={{ color: C.ink, fontWeight: 500 }}>{p}</Typography>
                    </Stack>
                  ))}
                </Stack>
                <Stack direction="row" spacing={1.5} sx={{ mt: 3.5 }}>
                  {demoStep > 0 && <Button variant="outlined" onClick={() => setDemoStep(demoStep - 1)} sx={{ ...btn, borderColor: C.line, color: C.body, height: 46, px: 2.5, flex: { xs: 1, sm: 'none' } }}>Back</Button>}
                  {demoStep < 3 ? (
                    <Button variant="contained" onClick={() => setDemoStep(demoStep + 1)} endIcon={<ArrowIcon />} sx={{ ...greenBtn, height: 46, px: 2.75, flex: { xs: 2, sm: 'none' } }}>Next step</Button>
                  ) : (
                    <Button variant="contained" onClick={() => navigate('/register')} endIcon={<ArrowIcon />} sx={{ ...lemonBtn, height: 46, px: 2.75, flex: { xs: 2, sm: 'none' } }}>Start free trial</Button>
                  )}
                </Stack>
              </Box>
            </Grid>

            <Grid item xs={12} md={7}>
              <BrowserFrame url={demoStep === 0 ? 'schoolbricks · register' : 'schoolbricks · dashboard'} shadow={false}>
                <Box key={demoStep} sx={{ minHeight: 360, animation: 'sbFade 0.35s ease', '@media (prefers-reduced-motion: reduce)': { animation: 'none' } }}>
                  {demoStep === 0 && (
                    <Box sx={{ p: { xs: 2.5, sm: 3.5 }, bgcolor: C.cream, minHeight: 360 }}>
                      <Typography sx={{ fontWeight: 800, color: C.ink, mb: 2.5 }}>Register your school</Typography>
                      {[
                        { label: 'School name', val: 'Greenfield Academy' },
                        { label: 'Address', val: '12 Admiralty Way, Lekki, Lagos' },
                        { label: 'Owner email', val: 'admin@greenfield.ng' },
                      ].map((f) => (
                        <Box key={f.label} sx={{ mb: 1.5 }}>
                          <Typography sx={{ color: C.muted, fontSize: '0.7rem', fontWeight: 600, mb: 0.4 }}>{f.label}</Typography>
                          <Box sx={{ px: 1.5, py: 1, bgcolor: '#fff', border: `1px solid ${C.line}`, borderRadius: '10px' }}>
                            <Typography sx={{ fontWeight: 600, color: C.ink, fontSize: '0.86rem' }}>{f.val}</Typography>
                          </Box>
                        </Box>
                      ))}
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.5, bgcolor: C.lemonSoft, borderRadius: '12px', mt: 2, border: '1px solid #dcefc8' }}>
                        <CheckIcon sx={{ fontSize: 20, color: brand.lemonDeep }} />
                        <Typography sx={{ fontWeight: 600, color: C.green, fontSize: '0.88rem' }}>Registered! Your School ID is ready.</Typography>
                      </Stack>
                    </Box>
                  )}

                  {demoStep === 1 && (
                    <Box sx={{ display: 'flex', minHeight: 360 }}>
                      <MiniSidebar items={['Dashboard', 'Students', 'Teachers', 'Classes']} active={3} />
                      <Box sx={{ flex: 1, p: 2.25, bgcolor: C.cream }}>
                        <Typography sx={{ fontWeight: 800, color: C.ink, mb: 1.5 }}>Classes</Typography>
                        {[
                          { name: 'JSS 1A', teacher: 'Mrs Okonkwo', n: 42 },
                          { name: 'JSS 2B', teacher: 'Mr Adeyemi', n: 38 },
                          { name: 'SS 1A', teacher: 'Mrs Balogun', n: 45 },
                          { name: 'SS 2A', teacher: 'Mr Ibrahim', n: 40 },
                        ].map((c) => (
                          <Stack key={c.name} direction="row" alignItems="center" spacing={1.5} sx={{ py: 1, px: 1.25, mb: 0.75, bgcolor: '#fff', borderRadius: '10px', border: `1px solid ${C.line}` }}>
                            <AreaBadge area="classes" size={28}><TimetableIcon /></AreaBadge>
                            <Box sx={{ flex: 1 }}>
                              <Typography sx={{ fontWeight: 700, color: C.ink, fontSize: '0.8rem' }}>{c.name}</Typography>
                              <Typography sx={{ color: C.muted, fontSize: '0.66rem' }}>{c.teacher}</Typography>
                            </Box>
                            <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: C.body }}>{c.n} students</Typography>
                          </Stack>
                        ))}
                      </Box>
                    </Box>
                  )}

                  {demoStep === 2 && (
                    <Box sx={{ display: 'flex', minHeight: 360 }}>
                      <MiniSidebar items={['Dashboard', 'Students', 'Teachers', 'Classes']} active={1} />
                      <Box sx={{ flex: 1, p: 2.25, bgcolor: C.cream }}>
                        <Typography sx={{ fontWeight: 800, color: C.ink, mb: 1.5 }}>Import students</Typography>
                        <Box sx={{ p: 1.75, border: `2px dashed ${areas.fees.solid}`, borderRadius: '12px', textAlign: 'center', bgcolor: areas.fees.tint, mb: 1.5 }}>
                          <Typography sx={{ fontWeight: 700, color: areas.fees.ink, fontSize: '0.8rem' }}>students.xlsx</Typography>
                          <Typography sx={{ color: C.body, fontSize: '0.68rem' }}>271 rows read</Typography>
                        </Box>
                        {[
                          { name: 'Adaeze Okafor', cls: 'JSS 1A' },
                          { name: 'Tunde Bakare', cls: 'JSS 1A' },
                          { name: 'Fatima Abdullahi', cls: 'JSS 2B' },
                        ].map((s) => (
                          <Stack key={s.name} direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 0.8, px: 1.25, mb: 0.5, bgcolor: '#fff', borderRadius: '8px', border: `1px solid ${C.line}` }}>
                            <Typography sx={{ fontWeight: 600, color: C.ink, fontSize: '0.76rem' }}>{s.name}</Typography>
                            <Box sx={{ px: 0.9, py: 0.2, borderRadius: '6px', bgcolor: areas.students.tint }}><Typography sx={{ fontSize: '0.64rem', fontWeight: 700, color: areas.students.ink }}>{s.cls}</Typography></Box>
                          </Stack>
                        ))}
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25, p: 1.1, bgcolor: C.lemonSoft, borderRadius: '10px' }}>
                          <CheckIcon sx={{ fontSize: 17, color: brand.lemonDeep }} />
                          <Typography sx={{ color: C.green, fontWeight: 700, fontSize: '0.76rem' }}>271 imported · 0 errors</Typography>
                        </Stack>
                      </Box>
                    </Box>
                  )}

                  {demoStep === 3 && <DashboardMock />}
                </Box>
              </BrowserFrame>
            </Grid>
          </Grid>

          <Box sx={{ textAlign: 'center', mt: { xs: 5, md: 7 } }}>
            <Typography sx={{ color: C.ink, fontWeight: 800, fontSize: '1.1rem' }}>Total setup time: under 15 minutes.</Typography>
            <Typography sx={{ color: C.muted }}>No IT department. No training. No consultants.</Typography>
          </Box>
        </Container>
      </Box>

      {/* ══════════════ Book a walkthrough ══════════════ */}
      <Box sx={{ pb: { xs: 7, md: 10 } }}>
        <Container maxWidth="md">
          <Box sx={{ p: { xs: 3, md: 4 }, borderRadius: '22px', bgcolor: C.lemonSoft, border: '1px solid #dcefc8' }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={7.5}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <VideocamIcon sx={{ fontSize: 19, color: C.lemonInk }} />
                  <Typography sx={{ color: C.lemonInk, letterSpacing: '1.5px', fontWeight: 800, fontSize: '12.5px', textTransform: 'uppercase' }}>Want a live demo?</Typography>
                </Stack>
                <Typography sx={{ fontWeight: 800, color: C.ink, mb: 1, lineHeight: 1.3, fontSize: { xs: '1.3rem', md: '1.5rem' } }}>
                  Book a free 30-minute walkthrough on Google Meet.
                </Typography>
                <Typography sx={{ color: C.body, lineHeight: 1.7 }}>
                  We'll show you the dashboard, answer your questions, and help you decide if SchoolBricks is right for your school.
                </Typography>
              </Grid>
              <Grid item xs={12} md={4.5} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                <Button variant="contained" size="large" href="#contact" endIcon={<ArrowIcon />} sx={{ ...greenBtn, px: 3.5, height: 52, width: { xs: '100%', md: 'auto' } }}>
                  Book a walkthrough
                </Button>
              </Grid>
            </Grid>
          </Box>
        </Container>
      </Box>

      {/* ══════════════ About ══════════════ */}
      <Box id="about" sx={{ py: { xs: 7, md: 11 }, bgcolor: C.cream, ...anchorOffset }}>
        <Container maxWidth="md">
          <SectionTitle eyebrow="Why we built it" title="Less paperwork. More teaching."
            sub="SchoolBricks was born from a simple observation: schools spend too much time on paperwork and not enough on education. We're building the most straightforward, affordable way to run a school in Nigeria." />
          <Grid container spacing={{ xs: 1.5, md: 2 }}>
            {[
              { num: '₦1,500', label: 'Per student, per term', sub: 'Every feature included' },
              { num: '14 days', label: 'Free trial', sub: 'No card needed' },
              { num: '15 min', label: 'To set up', sub: 'From sign-up to first student' },
              { num: '1 place', label: 'For everything', sub: 'Fees, registers and results' },
            ].map((stat) => (
              <Grid item xs={6} md={3} key={stat.label}>
                <Box sx={{ textAlign: 'center', height: '100%', p: { xs: 2, md: 2.5 }, borderRadius: '18px', bgcolor: '#fff', border: `1px solid ${C.line}` }}>
                  <Typography sx={{ fontWeight: 800, color: C.green, fontSize: { xs: '1.5rem', md: '1.85rem' }, letterSpacing: '-0.5px' }}>{stat.num}</Typography>
                  <Box sx={{ width: 22, height: 3, borderRadius: 2, bgcolor: C.lemon, mx: 'auto', my: 1 }} />
                  <Typography sx={{ fontWeight: 700, color: C.ink, fontSize: '0.92rem' }}>{stat.label}</Typography>
                  <Typography sx={{ color: C.muted, fontSize: '0.8rem' }}>{stat.sub}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ FAQ ══════════════ */}
      <Box id="faq" sx={{ py: { xs: 7, md: 12 }, ...anchorOffset }}>
        <Container maxWidth="md">
          <SectionTitle eyebrow="FAQ" title="Questions, answered" />
          <Stack spacing={1.25}>
            {faqs.map((faq) => (
              <Accordion key={faq.q} elevation={0} disableGutters
                sx={{ borderRadius: '14px !important', border: `1px solid ${C.line}`, bgcolor: '#fff', '&:before': { display: 'none' }, '&.Mui-expanded': { borderColor: C.lemon, boxShadow: `0 0 0 3px ${C.lemonSoft}` } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: C.green }} />} sx={{ px: { xs: 2, sm: 2.5 }, py: 0.5, minHeight: 60 }}>
                  <Typography sx={{ fontWeight: 700, color: C.ink, fontSize: { xs: '0.96rem', md: '1.02rem' }, pr: 1 }}>{faq.q}</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: { xs: 2, sm: 2.5 }, pt: 0, pb: 2.5 }}>
                  <Typography sx={{ color: C.body, lineHeight: 1.75, fontSize: '0.95rem' }}>{faq.a}</Typography>
                </AccordionDetails>
              </Accordion>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ══════════════ Contact ══════════════ */}
      <Box id="contact" sx={{ py: { xs: 7, md: 12 }, bgcolor: C.cream, ...anchorOffset }}>
        <Container maxWidth="lg">
          <SectionTitle eyebrow="Contact" title="Get in touch" sub="Questions, or want a personal demo? We'd love to hear from you." />
          <Grid container spacing={{ xs: 3, md: 4 }}>
            <Grid item xs={12} md={5}>
              <Stack spacing={1.5}>
                {[
                  { icon: <WhatsAppIcon />, title: 'WhatsApp', lines: [{ text: 'Chat with us', href: `https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hi SchoolBricks, I have a question.')}` }, { text: 'Usually replies within the hour' }] },
                  { icon: <PhoneIcon />, title: 'Phone', lines: [{ text: '0706 110 2797', href: 'tel:+2347061102797' }, { text: 'Mon – Fri, 8am – 6pm WAT' }] },
                  { icon: <LocationIcon />, title: 'Office', lines: [{ text: 'Lagos, Nigeria' }, { text: 'Serving schools across Nigeria' }] },
                ].map((c) => (
                  <Stack direction="row" spacing={2} key={c.title} alignItems="flex-start" sx={{ p: 2.25, borderRadius: '16px', bgcolor: '#fff', border: `1px solid ${C.line}` }}>
                    <Box sx={{ width: 42, height: 42, flexShrink: 0, borderRadius: '12px', bgcolor: C.lemonSoft, color: C.lemonInk, display: 'flex', alignItems: 'center', justifyContent: 'center', '& svg': { fontSize: 21 } }}>{c.icon}</Box>
                    <Box>
                      <Typography sx={{ fontWeight: 800, color: C.ink }}>{c.title}</Typography>
                      {c.lines.map((l) => l.href ? (
                        <Typography key={l.text} component="a" href={l.href} target={l.href.startsWith('http') ? '_blank' : undefined} rel="noopener noreferrer"
                          sx={{ display: 'block', color: C.green, fontWeight: 700, textDecoration: 'none', py: 0.25, '&:hover': { textDecoration: 'underline' } }}>
                          {l.text}
                        </Typography>
                      ) : (
                        <Typography key={l.text} sx={{ color: C.muted, fontSize: '0.9rem' }}>{l.text}</Typography>
                      ))}
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={7}>
              <Box sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: '20px', border: `1px solid ${C.line}`, bgcolor: '#fff' }}>
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
                      <Button type="submit" variant="contained" size="large" disabled={contactState === 'sending'}
                        endIcon={contactState === 'sending' ? <CircularProgress size={18} sx={{ color: C.green }} /> : <SendIcon />}
                        sx={{ ...lemonBtn, px: 4, height: 50, width: { xs: '100%', sm: 'auto' }, '&.Mui-disabled': { bgcolor: C.lemonSoft, color: C.green } }}>
                        {contactState === 'sending' ? 'Sending…' : 'Send message'}
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ Lemon band ══════════════ */}
      <Box sx={{ py: { xs: 3, md: 3.5 }, bgcolor: C.lemon, color: C.green, textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.05rem', md: '1.35rem' }, letterSpacing: '-0.3px' }}>
            Everything school. One platform.
          </Typography>
          <Typography sx={{ fontWeight: 500, fontSize: { xs: '0.92rem', md: '1rem' } }}>
            Fees, attendance, report cards and parent messages, all in one place.
          </Typography>
        </Container>
      </Box>

      {/* ══════════════ CTA ══════════════ */}
      <Box sx={{
        py: { xs: 8, md: 11 }, bgcolor: C.green, color: '#fff', textAlign: 'center',
        backgroundImage: 'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(122,199,53,0.25), rgba(122,199,53,0) 70%)',
      }}>
        <Container maxWidth="sm">
          <Typography component="h2" sx={{ fontWeight: 800, mb: 2, fontSize: { xs: '1.85rem', md: '2.7rem' }, letterSpacing: '-1px', lineHeight: 1.15 }}>
            Your school should run like a system, not a scramble.
          </Typography>
          <Typography sx={{ mb: 4, color: 'rgba(255,255,255,0.8)', fontSize: '1.05rem' }}>
            Save time, cut mistakes, and get back to education.
          </Typography>
          <Button variant="contained" size="large" onClick={() => navigate('/register')} endIcon={<ArrowIcon />} sx={{ ...lemonBtn, px: 5, height: 56, fontSize: '1.02rem', width: { xs: '100%', sm: 'auto' } }}>
            Start your 14-day free trial
          </Button>
          <Typography sx={{ display: 'block', mt: 2, color: 'rgba(255,255,255,0.7)', fontSize: '0.88rem' }}>No card required. Set up in about 15 minutes.</Typography>
        </Container>
      </Box>

      {/* ══════════════ Footer ══════════════ */}
      <Box component="footer" sx={{ py: 6, bgcolor: C.night, color: 'rgba(255,255,255,0.68)' }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={5}>
              <Logo dark />
              <Typography sx={{ maxWidth: 300, mt: 1.5, fontSize: '0.92rem', lineHeight: 1.7 }}>
                The school management platform built for Nigerian schools. Fees, attendance, results and parents, in one place.
              </Typography>
            </Grid>
            <Grid item xs={6} sm={4} md={2.33}>
              <Typography sx={{ fontWeight: 800, color: '#fff', mb: 1.25, fontSize: '0.95rem' }}>Product</Typography>
              <Stack spacing={{ xs: 0, md: 0.75 }}>
                {[{ label: 'Features', href: '#features' }, { label: 'How it works', href: '#demo' }, { label: 'Pricing', href: '#pricing' }, { label: 'FAQ', href: '#faq' }].map((l) => (
                  <Typography key={l.label} component="a" href={l.href} sx={{ textDecoration: 'none', color: 'inherit', fontSize: '0.92rem', py: { xs: 1, md: 0 }, '&:hover': { color: C.lemon } }}>{l.label}</Typography>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={6} sm={4} md={2.33}>
              <Typography sx={{ fontWeight: 800, color: '#fff', mb: 1.25, fontSize: '0.95rem' }}>Company</Typography>
              <Stack spacing={{ xs: 0, md: 0.75 }}>
                {[{ label: 'About', href: '#about' }, { label: 'Contact', href: '#contact' }, { label: 'Sign in', href: '/login' }].map((l) => (
                  <Typography key={l.label} component="a" href={l.href} sx={{ textDecoration: 'none', color: 'inherit', fontSize: '0.92rem', py: { xs: 1, md: 0 }, '&:hover': { color: C.lemon } }}>{l.label}</Typography>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} sm={4} md={2.33}>
              <Typography sx={{ fontWeight: 800, color: '#fff', mb: 1.25, fontSize: '0.95rem' }}>Get started</Typography>
              <Button variant="contained" onClick={() => navigate('/register')} sx={{ ...lemonBtn, height: 44, px: 2.5 }}>Register your school</Button>
            </Grid>
          </Grid>
          <Box sx={{ height: '1px', bgcolor: 'rgba(255,255,255,0.1)', my: 3.5 }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
            <Typography sx={{ fontSize: '0.85rem' }}>&copy; {new Date().getFullYear()} SchoolBricks. All rights reserved.</Typography>
            <Typography sx={{ fontSize: '0.85rem' }}>Built with care for Nigerian schools.</Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}
