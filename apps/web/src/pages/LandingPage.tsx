import { useState } from 'react'
import {
  GlobalStyles,
  Box,
  Typography,
  Button,
  Container,
  Grid,
  Paper,
  Stack,
  Divider,
  Chip,
  TextField,
  Alert,
  Tab,
  Tabs,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle as CheckIcon,
  ArrowForward as ArrowIcon,
  Send as SendIcon,
  Email as EmailIcon,
  Phone as PhoneIcon,
  LocationOn as LocationIcon,
  Payment as PaymentIcon,
  Notifications as NotifIcon,
  Lock as LockIcon,
  Flag as FlagIcon,
  People as PeopleIcon,
  CreditCard as CreditIcon,
  Description as ReportIcon,
  EventAvailable as AttendIcon,
  ExpandMore as ExpandMoreIcon,
  Videocam as VideocamIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
} from '@mui/icons-material'

/* ─── Personas ─── */
const personas = [
  {
    role: 'THE SCHOOL ADMIN',
    quote: '"Where did the money go? Who approved this?"',
    pains: [
      "You can't see at a glance how much has come in and how much is still owed",
      "Operations depend on one trusted staff member's memory",
      'End-of-term is three weeks of chasing and reconciling',
    ],
  },
  {
    role: 'THE TEACHER',
    quote: '"I became a teacher to teach, not to fill out forms."',
    pains: [
      'Attendance taken on paper, transcribed later (or lost)',
      'Grades live in personal notebooks, not a shared system',
      'Report card season means late nights and manual calculations',
    ],
  },
  {
    role: 'THE BURSAR',
    quote: '"If one more parent says \'I already paid\'..."',
    pains: [
      'Payment records scattered across receipts, bank apps, and memory',
      'No way to prove what was paid, when, and by whom',
      'Reconciliation takes days because nothing lives in one place',
    ],
  },
]

/* ─── Feature tabs ─── */
const featureTabs = [
  {
    label: 'SETUP',
    step: '01',
    title: 'Your school, configured in minutes',
    desc: 'Add your school details, create classes, set up terms and sessions. Import existing student data or start fresh. No IT team needed — if you can use WhatsApp, you can set up SchoolBricks.',
    highlights: ['School profile & branding', 'Class & section setup', 'Term & session management', 'Staff onboarding'],
  },
  {
    label: 'STUDENTS',
    step: '02',
    title: 'Every student, one complete record',
    desc: 'Enrol students, assign classes, track attendance, record grades, and manage parent contacts. Everything about a student lives in one place — accessible to the right people.',
    highlights: ['Student enrollment & profiles', 'Attendance tracking', 'Academic records & results', 'Parent contact info'],
  },
  {
    label: 'FEES',
    step: '03',
    title: 'Know who owes, who paid, instantly',
    desc: 'Set fee structures per class and term. Generate invoices, record payments, track outstanding balances. No more arguments about who paid what — every transaction has a digital receipt.',
    highlights: ['Fee structure by class & term', 'Payment recording & receipts', 'Outstanding balance tracking', 'Financial reports'],
  },
  {
    label: 'TEAM',
    step: '04',
    title: 'Your team, their roles, your control',
    desc: 'Add teachers and admin staff. Assign roles and permissions so everyone sees exactly what they need to — nothing more. You stay in control of who can access what.',
    highlights: ['Teacher profiles & assignments', 'Role-based access control', 'Department management', 'Activity oversight'],
  },
]

/* ─── System features ─── */
const systemFeatures = [
  { code: 'SYS-01', icon: <PeopleIcon sx={{ fontSize: 28 }} />, title: 'Student Management', desc: 'Profiles, enrollment, class rosters, and student lists imported from Excel.' },
  { code: 'SYS-02', icon: <CreditIcon sx={{ fontSize: 28 }} />, title: 'Fee Collection', desc: 'Fee types, termly invoices, and payments you can see the moment they clear.' },
  { code: 'SYS-03', icon: <ReportIcon sx={{ fontSize: 28 }} />, title: 'Report Cards', desc: 'Generated from grades, downloaded as PDF. Per student, per class, per term.' },
  { code: 'SYS-04', icon: <AttendIcon sx={{ fontSize: 28 }} />, title: 'Attendance', desc: 'Mark attendance daily. Track patterns per student and per class.' },
]

/* Offset for in-page anchors so the sticky navbar doesn't cover section headings */
const anchorOffset = { scrollMarginTop: { xs: '72px', md: '80px' } }

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
  { title: 'Term-based billing.', desc: 'Not semesters. Not arbitrary cycles. Three terms, the way your school runs.' },
  { title: 'Online payments.', desc: 'Parents pay via bank transfer, card, or USSD. You see it the second it clears.' },
  { title: 'WhatsApp-first.', desc: 'Invoices, reminders, and receipts go where parents already are.' },
  { title: 'Your data stays private.', desc: "Your school's records are kept separate from every other school's and protected at all times \u2014 and we follow Nigeria's data-protection rules (NDPR)." },
  { title: 'Naira-native.', desc: 'Every invoice, every report, every dashboard \u2014 in Naira. No conversions.' },
]

/* ─── FAQ data ─── */
const faqs = [
  { q: 'What types of schools is SchoolBricks for?', a: 'SchoolBricks is built for nursery, primary, and secondary schools in Nigeria. Whether you run a single campus or a group of schools, our platform adapts to your structure \u2014 classes, terms, fee types, and all.' },
  { q: 'How long does setup take?', a: 'Most schools are fully set up in under 15 minutes. Just add your school details, create your classes, and start enrolling students. You can also import your existing student list from Excel.' },
  { q: 'Do parents need to download an app?', a: 'No. Parents receive invoices, reminders, receipts, and report card alerts via WhatsApp and email. No app download required \u2014 we meet parents where they already are.' },
  { q: 'How do parents pay fees?', a: 'Parents can pay via bank transfer, card, or USSD through our integrated Paystack payment gateway. Every payment is recorded instantly in your dashboard \u2014 no manual reconciliation needed.' },
  { q: "Is my school's data secure?", a: "Yes. Each school's data is completely isolated from every other school. We use industry-standard encryption, secure cloud infrastructure, and comply with Nigeria's Data Protection Regulation (NDPR)." },
  { q: 'Can I move from another school management tool?', a: 'Absolutely. We support data import from Excel and CSV files. Our support team can also help you migrate your existing records during onboarding.' },
  { q: 'How much does SchoolBricks cost?', a: '\u20A61,500 per active student, per term, with every feature included. A school with 300 students pays \u20A6450,000 a term. Students who have left or graduated are not counted.' },
  { q: 'What happens after the 14-day free trial?', a: 'You get an invoice for the current term, paid online with Paystack. There is then a 7-day grace period. If it is still unpaid after that, your school becomes read-only until payment: you can view and print everything, but not make changes. Nothing is ever deleted.' },
  { q: 'Do text messages cost extra?', a: 'Messages to parents always appear free on their parent page. SMS is optional and goes through your school\'s own Termii account, so you pay Termii directly for the texts you send.' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [activeTab, setActiveTab] = useState(0)
  const [demoStep, setDemoStep] = useState(0)
  const [studentCount, setStudentCount] = useState('300')

  const navLinks = [
    { label: 'Features', href: '#features' },
    { label: 'Demo', href: '#demo' },
    { label: 'Pricing', href: '#pricing' },
    { label: 'About', href: '#about' },
    { label: 'Contact', href: '#contact' },
  ]
  const [contactForm, setContactForm] = useState({ name: '', email: '', school: '', message: '' })
  const [contactSent, setContactSent] = useState(false)

  return (
    // overflowX 'clip' (not 'hidden') keeps decorative shapes from widening the page
    // without turning this box into a scroll container, which would break the sticky navbar.
    <Box sx={{ width: '100%', overflowX: 'clip', bgcolor: '#fff' }}>
      <GlobalStyles styles={{ html: { scrollBehavior: 'smooth' } }} />

      {/* ══════════════ Navbar ══════════════ */}
      <Box component="nav" sx={{ position: 'sticky', top: 0, zIndex: 1100, bgcolor: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottom: '1px solid #eee' }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: { xs: 1, md: 1.5 } }}>
            <Box sx={{ cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#111', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                SchoolBricks
              </Typography>
              <Typography variant="caption" sx={{ color: '#888', fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                Everything School. One Platform.
              </Typography>
            </Box>

            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
              {navLinks.map((link) => (
                <Button key={link.label} sx={{ color: '#555', textTransform: 'none', fontWeight: 500 }} href={link.href}>{link.label}</Button>
              ))}
              <Button sx={{ color: '#555', textTransform: 'none', fontWeight: 500 }} onClick={() => navigate('/login')}>Sign In</Button>
              <Button variant="contained" onClick={() => navigate('/register')}
                sx={{ bgcolor: '#111', color: '#fff', textTransform: 'none', borderRadius: 2, fontWeight: 600, px: 2.5, '&:hover': { bgcolor: '#333' } }}>
                Get Started
              </Button>
            </Stack>

            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: { xs: 'flex', md: 'none' } }}>
              <Button variant="contained" onClick={() => navigate('/register')}
                sx={{ bgcolor: '#111', color: '#fff', textTransform: 'none', borderRadius: 2, fontWeight: 600, minHeight: 40, px: 2, boxShadow: 'none', '&:hover': { bgcolor: '#333' } }}>
                Get Started
              </Button>
              <IconButton aria-label="Open menu" onClick={() => setMobileMenuOpen(true)} sx={{ color: '#111', width: 44, height: 44 }}>
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
        sx={{ display: { md: 'none' }, '& .MuiDrawer-paper': { width: '86%', maxWidth: 340, display: 'flex', flexDirection: 'column' } }}
      >
        <Box sx={{ px: 2.5, py: 1.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: '#0d3b2e', color: '#fff' }}>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: '1.1rem', lineHeight: 1.2 }}>SchoolBricks</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.65)' }}>Everything School. One Platform.</Typography>
          </Box>
          <IconButton aria-label="Close menu" onClick={() => setMobileMenuOpen(false)} sx={{ color: '#fff', width: 44, height: 44 }}><CloseIcon /></IconButton>
        </Box>
        <List sx={{ px: 1.5, py: 1.5, flex: 1 }}>
          {navLinks.map((link) => (
            <ListItemButton key={link.label} component="a" href={link.href} onClick={() => setMobileMenuOpen(false)}
              sx={{ borderRadius: 2, minHeight: 52 }}>
              <ListItemText primary={link.label} primaryTypographyProps={{ fontWeight: 600, fontSize: '1.05rem', color: '#111' }} />
              <ArrowIcon sx={{ fontSize: 18, color: '#bbb' }} />
            </ListItemButton>
          ))}
        </List>
        <Stack spacing={1.25} sx={{ p: 2.5, borderTop: '1px solid #eee' }}>
          <Button fullWidth variant="contained" size="large" onClick={() => { setMobileMenuOpen(false); navigate('/register') }}
            sx={{ bgcolor: '#8bc34a', color: '#fff', textTransform: 'none', borderRadius: 2, fontWeight: 700, py: 1.4, boxShadow: 'none', '&:hover': { bgcolor: '#7cb342' } }}>
            Start 14-day free trial
          </Button>
          <Button fullWidth variant="outlined" size="large" onClick={() => { setMobileMenuOpen(false); navigate('/login') }}
            sx={{ borderColor: '#ddd', color: '#111', textTransform: 'none', borderRadius: 2, fontWeight: 600, py: 1.4 }}>
            Sign In
          </Button>
        </Stack>
      </Drawer>

      {/* ══════════════ Hero Banner ══════════════ */}
      <Box sx={{ position: 'relative', overflow: 'hidden', bgcolor: '#0d3b2e', color: '#fff' }}>
        {/* Background shapes */}
        <Box sx={{ position: 'absolute', top: -120, right: -80, width: 420, height: 420, borderRadius: '50%', bgcolor: 'rgba(139,195,74,0.12)', zIndex: 0 }} />
        <Box sx={{ position: 'absolute', bottom: -100, left: -60, width: 320, height: 320, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', zIndex: 0 }} />
        <Box sx={{ position: 'absolute', top: '40%', left: '60%', width: 160, height: 160, borderRadius: '50%', bgcolor: 'rgba(139,195,74,0.2)', zIndex: 0, display: { xs: 'none', md: 'block' } }} />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, pt: { xs: 5, md: 10 }, pb: { xs: 6, md: 10 } }}>
          <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Chip label="Everything School. One Platform." size="small" sx={{ mb: 2, bgcolor: 'rgba(139,195,74,0.2)', color: '#dcedc8', fontWeight: 600, border: '1px solid rgba(139,195,74,0.3)' }} />
              <Typography variant="h1" sx={{ fontWeight: 800, fontSize: { xs: '2.35rem', sm: '3rem', md: '3.6rem' }, lineHeight: 1.08, letterSpacing: { xs: '-1px', md: '-1.5px' }, mb: { xs: 2, md: 3 } }}>
                Online School Management{' '}
                <Box component="span" sx={{ color: '#aed581' }}>Software</Box>
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: { xs: 1.65, md: 1.8 }, mb: { xs: 3, md: 4 }, maxWidth: 440 }}>
                Run your entire school from one beautiful dashboard. Fees, attendance, gradebooks, parent communication, and timetables — all connected.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1.25, sm: 2 }} sx={{ mb: 3 }}>
                <Button variant="contained" size="large" onClick={() => navigate('/register')} endIcon={<ArrowIcon />}
                  sx={{ bgcolor: '#8bc34a', color: '#fff', textTransform: 'none', borderRadius: 2, fontWeight: 700, px: 4, py: 1.5, fontSize: '1rem', '&:hover': { bgcolor: '#7cb342' } }}>
                  Sign up for free
                </Button>
                <Button variant="outlined" size="large" href="#demo"
                  sx={{ borderColor: 'rgba(255,255,255,0.5)', color: '#fff', textTransform: 'none', borderRadius: 2, fontWeight: 600, px: 4, py: 1.5, fontSize: '1rem', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
                  Watch demo
                </Button>
              </Stack>
              <Stack direction="row" sx={{ flexWrap: 'wrap', columnGap: 2, rowGap: 1 }}>
                {['No credit card', 'Setup in 15 minutes', '14-day free trial'].map((b) => (
                  <Stack direction="row" spacing={0.5} alignItems="center" key={b}>
                    <CheckIcon sx={{ fontSize: 16, color: '#8bc34a' }} />
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.75)' }}>{b}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>

            <Grid item xs={12} md={7}>
              <Paper elevation={12} sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                <Box sx={{ px: 2, py: 0.75, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ff5f57' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ffbd2e' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#28c840' }} />
                  <Box sx={{ flex: 1, ml: 1, px: 1.5, py: 0.3, bgcolor: '#fff', borderRadius: 0.5, border: '1px solid #e0e0e0' }}>
                    <Typography variant="caption" sx={{ color: '#999', fontSize: '0.65rem' }}>schoolbricks.app/dashboard</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', minHeight: 340, bgcolor: '#fafafa' }}>
                  <Box sx={{ width: 150, bgcolor: '#1b5e20', py: 2, px: 1.5, display: { xs: 'none', sm: 'block' } }}>
                    <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, display: 'block', mb: 2, px: 0.5 }}>SchoolBricks</Typography>
                    {['Dashboard','Students','Teachers','Classes','Attendance','Exams','Fees','Payments'].map((item, i) => (
                      <Box key={item} sx={{ px: 1, py: 0.5, borderRadius: 1, mb: 0.25, bgcolor: i === 0 ? 'rgba(255,255,255,0.15)' : 'transparent' }}>
                        <Typography variant="caption" sx={{ color: i === 0 ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>{item}</Typography>
                      </Box>
                    ))}
                  </Box>
                  <Box sx={{ flex: 1, p: { xs: 1.5, sm: 2 }, bgcolor: '#fafafa' }}>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: '#111', display: 'block', mb: 0.25 }}>Greenville Academy's Dashboard</Typography>
                    <Typography variant="caption" sx={{ color: '#999', display: 'block', mb: 2, fontSize: '0.6rem' }}>2026/2027 Academic Year · First Term</Typography>
                    <Grid container spacing={{ xs: 0.75, sm: 1 }}>
                      {[
                        { label: 'Attendance', value: '94%', color: '#e8f5e9' },
                        { label: 'Fees Collected', value: '\u20A66.2M', color: '#e3f2fd' },
                        { label: 'Students', value: '271', color: '#fff3e0' },
                        { label: 'Outstanding', value: '\u20A6890k', color: '#ffebee' },
                      ].map((card) => (
                        <Grid item xs={6} key={card.label}>
                          <Paper elevation={0} sx={{ p: { xs: 0.75, sm: 1 }, borderRadius: 1.5, border: '1px solid #eee', bgcolor: card.color }}>
                            <Typography variant="caption" sx={{ color: '#888', fontSize: '0.6rem' }}>{card.label}</Typography>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: '#111', fontSize: '0.8rem' }}>{card.value}</Typography>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                    <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: '#fff', border: '1px solid #eee' }}>
                      <Typography variant="caption" sx={{ color: '#888', fontSize: '0.6rem', display: 'block', mb: 1 }}>Fees Collection Trend</Typography>
                      <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ height: 60 }}>
                        {['Jan','Feb','Mar','Apr','May','Jun','Jul'].map((m, i) => (
                          <Box key={m} sx={{ flex: 1, textAlign: 'center' }}>
                            <Box sx={{ height: 15 + i * 7, bgcolor: i === 6 ? '#8bc34a' : '#c8e6c9', borderRadius: 0.5, mx: 'auto', width: '70%' }} />
                            <Typography variant="caption" sx={{ color: '#999', fontSize: '0.5rem' }}>{m}</Typography>
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ Feature banner ══════════════ */}
      <Box sx={{ py: { xs: 5, md: 8 }, bgcolor: '#f6f7f4' }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
            <Typography variant="overline" sx={{ color: '#8bc34a', letterSpacing: 2, fontWeight: 700 }}>
              POWERFUL FEATURES
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#2d3748', mt: 1, fontSize: { xs: '1.6rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
              Everything your school needs to run smoothly
            </Typography>
          </Box>
          <Grid container spacing={{ xs: 1.5, sm: 3 }}>
            {[
              { icon: <ReportIcon sx={{ fontSize: 24, color: '#689f38' }} />, title: 'Gradebook & Reports', desc: 'Customizable gradebook software and automatic report card generation.' },
              { icon: <AttendIcon sx={{ fontSize: 24, color: '#689f38' }} />, title: 'Attendance Tracking', desc: 'Classroom and attendance management with real-time notifications.' },
              { icon: <CreditIcon sx={{ fontSize: 24, color: '#689f38' }} />, title: 'Fees & Payments', desc: 'Online payments, invoices, receipts, and outstanding balance tracking.' },
              { icon: <PeopleIcon sx={{ fontSize: 24, color: '#689f38' }} />, title: 'Student Information', desc: 'Powerful SIS for student records, admissions, and parent portals.' },
              { icon: <NotifIcon sx={{ fontSize: 24, color: '#689f38' }} />, title: 'Parent Communication', desc: 'WhatsApp and SMS alerts to keep parents informed instantly.' },
              { icon: <LockIcon sx={{ fontSize: 24, color: '#689f38' }} />, title: 'Secure & Private', desc: 'Role-based access and NDPR-aligned data protection for every school.' },
            ].map((f) => (
              <Grid item xs={12} sm={6} md={4} key={f.title}>
                <Paper elevation={0} sx={{
                  p: { xs: 2, sm: 3 }, height: '100%', borderRadius: 3, border: '1px solid #e6e8e3', bgcolor: '#fff',
                  display: { xs: 'flex', sm: 'block' }, gap: 2, alignItems: 'flex-start',
                  transition: 'box-shadow 0.2s, transform 0.2s',
                  '&:hover': { boxShadow: '0 8px 24px rgba(13,59,46,0.08)', transform: { md: 'translateY(-2px)' } },
                }}>
                  <Box sx={{ width: 44, height: 44, flexShrink: 0, borderRadius: 2.5, bgcolor: '#f1f8e9', display: 'flex', alignItems: 'center', justifyContent: 'center', mb: { xs: 0, sm: 2 } }}>
                    {f.icon}
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#2d3748', mb: 0.5, fontSize: { xs: '1rem', sm: '1.05rem' } }}>{f.title}</Typography>
                    <Typography variant="body2" sx={{ color: '#718096', lineHeight: 1.6 }}>{f.desc}</Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ Trust badges ══════════════ */}
      <Box sx={{ py: 3, borderBottom: '1px solid #eee', bgcolor: '#fff' }}>
        <Container maxWidth="lg">
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, auto)' }, justifyContent: { md: 'center' }, columnGap: { xs: 1.5, md: 4 }, rowGap: 1.5 }}>
            {[
              { icon: <FlagIcon sx={{ fontSize: 16, color: '#8bc34a' }} />, label: 'Built for Nigerian schools' },
              { icon: <PaymentIcon sx={{ fontSize: 16, color: '#8bc34a' }} />, label: 'Online payments' },
              { icon: <NotifIcon sx={{ fontSize: 16, color: '#8bc34a' }} />, label: 'WhatsApp notifications' },
              { icon: <LockIcon sx={{ fontSize: 16, color: '#8bc34a' }} />, label: 'Your data stays private' },
            ].map((badge) => (
              <Stack key={badge.label} direction="row" spacing={0.75} alignItems="center">
                <Box>{badge.icon}</Box>
                <Typography variant="body2" sx={{ color: '#666', fontWeight: 500, fontSize: { xs: '0.78rem', md: '0.85rem' } }}>{badge.label}</Typography>
              </Stack>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ══════════════ Meet Your Team (Personas) ══════════════ */}
      <Box sx={{ py: { xs: 7, md: 12 } }}>
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', textAlign: 'center', mb: { xs: 1.5, md: 2 }, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
            Every school runs on these three people
          </Typography>
          <Typography variant="body1" sx={{ color: '#888', textAlign: 'center', mb: { xs: 4, md: 8 }, maxWidth: 500, mx: 'auto' }}>
            Meet your team — and the problems they face every single term.
          </Typography>

          <Stack spacing={{ xs: 2, md: 10 }}>
            {personas.map((p) => (
              <Box key={p.role} sx={{
                p: { xs: 2.5, md: 0 },
                borderRadius: { xs: 3, md: 0 },
                bgcolor: { xs: '#f7f8f5', md: 'transparent' },
                borderLeft: { xs: '4px solid #8bc34a', md: 'none' },
              }}>
                <Typography variant="overline" sx={{ color: { xs: '#689f38', md: '#999' }, letterSpacing: 3, fontWeight: 700, display: 'block', mb: { xs: 0.75, md: 1.5 }, lineHeight: 1.6 }}>
                  {p.role}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#111', mb: { xs: 2, md: 3 }, fontSize: { xs: '1.2rem', md: '1.85rem' }, lineHeight: 1.35, maxWidth: 550 }}>
                  {p.quote}
                </Typography>
                <Stack spacing={{ xs: 1, md: 1.5 }}>
                  {p.pains.map((pain) => (
                    <Stack direction="row" spacing={1.5} key={pain} alignItems="flex-start">
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: { xs: '#aed581', md: '#ccc' }, mt: 1, flexShrink: 0 }} />
                      <Typography variant="body1" sx={{ color: '#666', lineHeight: 1.6, fontSize: { xs: '0.92rem', md: '1rem' } }}>{pain}</Typography>
                    </Stack>
                  ))}
                </Stack>
                <Divider sx={{ mt: 5, display: { xs: 'none', md: 'block' } }} />
              </Box>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ══════════════ Transition statement ══════════════ */}
      <Box sx={{ py: { xs: 5, md: 10 }, bgcolor: '#fafafa' }}>
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', textAlign: 'center', fontSize: { xs: '1.4rem', md: '2.25rem' }, letterSpacing: '-0.5px' }}>
            SchoolBricks gives each of them a system that works.
          </Typography>
        </Container>
      </Box>

      {/* ══════════════ Features (Tabbed) ══════════════ */}
      <Box id="features" sx={{ py: { xs: 7, md: 12 }, ...anchorOffset }}>
        <Container maxWidth="lg">
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            centered={!isMobile}
            variant={isMobile ? 'fullWidth' : 'standard'}
            sx={{
              mb: { xs: 3, md: 6 },
              borderBottom: { xs: '1px solid #eee', md: 'none' },
              '& .MuiTab-root': { textTransform: 'uppercase', fontWeight: 700, letterSpacing: { xs: 1, sm: 2 }, color: '#999', fontSize: { xs: '0.72rem', sm: '0.85rem' }, minWidth: { xs: 0, sm: 90 }, px: { xs: 0.5, sm: 2 }, minHeight: 48 },
              '& .Mui-selected': { color: '#111' },
              '& .MuiTabs-indicator': { bgcolor: '#111', height: 3 },
            }}
          >
            {featureTabs.map((t) => (
              <Tab key={t.label} label={t.label} />
            ))}
          </Tabs>

          <Grid container spacing={{ xs: 0, md: 6 }} alignItems="center">
            {/* Feature mockup — repeats the text beside it, so it's hidden on phones */}
            <Grid item xs={12} md={6} sx={{ display: { xs: 'none', md: 'block' } }}>
              <Paper elevation={2} sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid #eee' }}>
                <Box sx={{ px: 2, py: 0.75, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0', display: 'flex', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ff5f57' }} />
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#ffbd2e' }} />
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#28c840' }} />
                </Box>
                <Box sx={{ p: 3, bgcolor: '#fafafa', minHeight: 280 }}>
                  <Typography variant="overline" sx={{ color: '#999', letterSpacing: 2 }}>{featureTabs[activeTab].label}</Typography>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#111', mb: 2 }}>{featureTabs[activeTab].title}</Typography>
                  <Grid container spacing={1.5}>
                    {featureTabs[activeTab].highlights.map((h, i) => (
                      <Grid item xs={6} key={h}>
                        <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #eee', bgcolor: '#fff' }}>
                          <Typography variant="caption" sx={{ color: '#999', fontWeight: 600, display: 'block' }}>0{i + 1}</Typography>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#111', fontSize: '0.8rem' }}>{h}</Typography>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </Paper>
            </Grid>

            {/* Feature description */}
            <Grid item xs={12} md={6}>
              <Typography variant="overline" sx={{ color: '#689f38', fontWeight: 700, letterSpacing: 2 }}>
                {featureTabs[activeTab].step} {featureTabs[activeTab].label}
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 800, color: '#111', mt: 1, mb: 2, fontSize: { xs: '1.5rem', md: '2rem' }, letterSpacing: '-0.5px' }}>
                {featureTabs[activeTab].title}
              </Typography>
              <Typography variant="body1" sx={{ color: '#666', lineHeight: 1.8, mb: 3 }}>
                {featureTabs[activeTab].desc}
              </Typography>
              <Stack spacing={1.5}>
                {featureTabs[activeTab].highlights.map((h) => (
                  <Stack direction="row" spacing={1.5} key={h} alignItems="center">
                    <CheckIcon sx={{ fontSize: 18, color: '#111' }} />
                    <Typography variant="body2" sx={{ color: '#444', fontWeight: 500 }}>{h}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ Everything your school runs on ══════════════ */}
      <Box sx={{ py: { xs: 7, md: 12 }, bgcolor: '#fafafa' }}>
        <Container maxWidth="lg">
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', textAlign: 'center', mb: { xs: 4, md: 6 }, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
            Everything your school runs on
          </Typography>
          {/* 1px gaps over a grey background draw even hairlines between tiles at every width */}
          <Box sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' },
            gap: '1px', bgcolor: '#e0e0e0', border: '1px solid #e0e0e0',
            borderRadius: { xs: 3, md: 0 }, overflow: 'hidden',
          }}>
            {systemFeatures.map((sf, idx) => (
              <Box
                key={sf.code}
                sx={{
                  p: { xs: 2, sm: 3.5 },
                  bgcolor: idx === 3 ? '#111' : '#fff',
                  transition: 'background-color 0.3s',
                  '&:hover': { bgcolor: idx === 3 ? '#222' : '#f5f5f5' },
                }}
              >
                <Typography variant="caption" sx={{ color: idx === 3 ? 'rgba(255,255,255,0.5)' : '#999', letterSpacing: 2, fontWeight: 600, display: 'block', mb: { xs: 1.25, sm: 2 }, fontSize: { xs: '0.65rem', sm: '0.75rem' } }}>
                  {sf.code}
                </Typography>
                <Box sx={{ mb: { xs: 1.25, sm: 2 }, color: idx === 3 ? '#aed581' : '#111', display: 'flex' }}>{sf.icon}</Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, color: idx === 3 ? '#fff' : '#111', mb: 0.75, fontSize: { xs: '0.95rem', sm: '1rem' }, lineHeight: 1.3 }}>
                  {sf.title}
                </Typography>
                <Typography variant="body2" sx={{ color: idx === 3 ? 'rgba(255,255,255,0.7)' : '#666', lineHeight: 1.55, fontSize: { xs: '0.8rem', sm: '0.875rem' } }}>
                  {sf.desc}
                </Typography>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* ══════════════ Pricing ══════════════ */}
      <Box id="pricing" sx={{ py: { xs: 7, md: 12 }, ...anchorOffset }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', mb: 1.5, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
              Simple pricing. No surprises.
            </Typography>
          </Box>

          <Typography sx={{ textAlign: 'center', color: '#666', mb: { xs: 4, sm: 5 }, fontSize: { xs: '0.95rem', sm: '1.05rem' } }}>
            One price for everything. You only pay for students who are actually enrolled.
          </Typography>

          <Paper elevation={0} sx={{ maxWidth: 920, mx: 'auto', border: '1px solid #e0e0e0', borderRadius: 3, overflow: 'hidden' }}>
            <Grid container>
              <Grid item xs={12} md={6} sx={{ p: { xs: 3, md: 5 }, bgcolor: '#0d3b2e', color: '#fff' }}>
                <Typography variant="overline" sx={{ color: '#aed581', fontWeight: 700, letterSpacing: '0.12em' }}>Per student, per term</Typography>
                <Typography sx={{ fontSize: { xs: '2.75rem', md: '3.5rem' }, fontWeight: 800, letterSpacing: '-1.5px', lineHeight: 1.1 }}>₦1,500</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.75)', mb: 3 }}>for each active student, billed at the start of each term.</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 600, mb: 1 }}>Work out your cost</Typography>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
                  <TextField
                    value={studentCount}
                    onChange={(e) => setStudentCount(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    inputProps={{ inputMode: 'numeric', 'aria-label': 'Number of students' }}
                    size="small"
                    sx={{ width: 120, '& .MuiOutlinedInput-root': { bgcolor: '#fff', borderRadius: 2 } }}
                  />
                  <Typography sx={{ color: 'rgba(255,255,255,0.85)' }}>students</Typography>
                </Stack>
                <Typography sx={{ fontSize: '1.4rem', fontWeight: 800 }}>
                  ₦{(Number(studentCount || 0) * 1500).toLocaleString('en-NG')} <Box component="span" sx={{ fontSize: '0.95rem', fontWeight: 500, color: 'rgba(255,255,255,0.75)' }}>per term</Box>
                </Typography>
                <Button variant="contained" size="large" onClick={() => navigate('/register')}
                  sx={{ mt: 3, bgcolor: '#8bc34a', color: '#0d3b2e', textTransform: 'none', fontWeight: 700, borderRadius: 2, px: 4, '&:hover': { bgcolor: '#9ccc65' } }}>
                  Start 14-day free trial
                </Button>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', mt: 1.25 }}>No card needed to start.</Typography>
              </Grid>
              <Grid item xs={12} md={6} sx={{ p: { xs: 3, md: 5 } }}>
                <Typography sx={{ fontWeight: 700, color: '#111', mb: 2 }}>Everything is included</Typography>
                <Stack spacing={1.25}>
                  {included.map((f) => (
                    <Stack key={f} direction="row" spacing={1.25} alignItems="flex-start">
                      <CheckIcon sx={{ fontSize: 18, color: '#2e7d32', mt: 0.25, flexShrink: 0 }} />
                      <Typography variant="body2" sx={{ color: '#333', lineHeight: 1.55 }}>{f}</Typography>
                    </Stack>
                  ))}
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          <Typography variant="body2" sx={{ textAlign: 'center', color: '#999', mt: 2 }}>
            Start with a 14-day free trial. No card required.
          </Typography>
        </Container>
      </Box>

      {/* ══════════════ Built for Nigerian schools ══════════════ */}
      <Box sx={{ py: { xs: 7, md: 10 }, bgcolor: '#111' }}>
        <Container maxWidth="lg">
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#fff', textAlign: 'center', mb: { xs: 4, md: 6 }, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
            Built for how Nigerian schools actually work
          </Typography>
          <Grid container spacing={{ xs: 1.5, sm: 2 }}>
            {nigerianValues.map((v, idx) => (
              <Grid item xs={12} sm={6} md={idx < 3 ? 4 : 6} key={v.title}>
                <Box sx={{ p: { xs: 2.25, sm: 3 }, borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)', height: '100%', borderLeft: '3px solid #8bc34a' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>{v.title}</Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>{v.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ Demo — Interactive Setup ══════════════ */}
      <Box id="demo" sx={{ py: { xs: 7, md: 12 }, ...anchorOffset }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: { xs: 3.5, md: 5 } }}>
            <Typography variant="overline" sx={{ color: '#999', letterSpacing: 3, fontWeight: 600 }}>
              INTERACTIVE DEMO
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', mt: 1, mb: 1.5, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
              From sign-up to fully running — in 4 steps
            </Typography>
            <Typography variant="body1" sx={{ color: '#888', maxWidth: 500, mx: 'auto' }}>
              Click through each step to see how SchoolBricks gets your school ready.
            </Typography>
          </Box>

          {/* Step pills: one segmented row on phones, separate chips from tablet up */}
          <Box sx={{
            display: 'grid', gridTemplateColumns: { xs: 'repeat(4, 1fr)', sm: 'repeat(4, auto)' }, justifyContent: 'center',
            gap: { xs: 0.5, sm: 1 }, mb: 4, mx: 'auto', maxWidth: { xs: 420, sm: 'none' },
            p: { xs: 0.5, sm: 0 }, bgcolor: { xs: '#f3f3f3', sm: 'transparent' }, borderRadius: { xs: 3, sm: 0 },
          }}>
            {['Register', 'Classes', 'Students', 'Live'].map((label, i) => (
              <Chip key={label} label={isMobile ? `${i + 1}. ${label}` : label} onClick={() => setDemoStep(i)}
                sx={{
                  fontWeight: 600, fontSize: { xs: '0.75rem', sm: '0.82rem' }, px: { xs: 0, sm: 1 }, height: { xs: 38, sm: 32 }, cursor: 'pointer',
                  borderRadius: { xs: 2.5, sm: 4 },
                  '& .MuiChip-label': { px: { xs: 0.5, sm: 1.5 } },
                  bgcolor: demoStep === i ? '#111' : { xs: 'transparent', sm: '#fff' }, color: demoStep === i ? '#fff' : '#555',
                  border: demoStep === i ? 'none' : { xs: 'none', sm: '1px solid #ddd' },
                  '&:hover': { bgcolor: demoStep === i ? '#333' : '#e9e9e9' },
                }}
              />
            ))}
          </Box>

          <Grid container spacing={4}>
            {/* Left: description */}
            <Grid item xs={12} md={5}>
              {[
                { title: 'Register your school', time: '2 minutes', desc: 'Enter your school name, address, and create your owner account. Choose your academic calendar. You get a unique School ID instantly — your login key from now on.', points: ['School name & address', 'Owner email & password', '3-term or 2-semester calendar', 'Instant School ID'] },
                { title: 'Create your classes', time: '3 minutes', desc: 'Add each class — JSS 1, SS 2, Primary 4, Nursery 2 — or bulk-import from CSV. Set grade level, capacity, and assign a class teacher.', points: ['Add or bulk-import classes', 'Set grade level & capacity', 'Assign class teachers', 'Any structure supported'] },
                { title: 'Enrol your students', time: '5 minutes', desc: 'Upload your entire student list from Excel. Each student gets a profile with admission number, class assignment, parent contacts. No retyping.', points: ['CSV/Excel import up to 500 at once', 'Auto-assigned to classes', 'Parent contacts stored', 'Profiles created instantly'] },
                { title: 'You are live', time: 'Now', desc: 'Teachers mark attendance today. Invoices go out via WhatsApp. Parents pay online and you see it instantly. The bursar never argues about who paid again.', points: ['Attendance from day one', 'Fee invoices via WhatsApp', 'Real-time payment tracking', 'Role-based access for all staff'] },
              ].map((s, i) => (
                <Box key={s.title} sx={{ display: demoStep === i ? 'block' : 'none', animation: 'fadeIn 0.4s ease', '@keyframes fadeIn': { from: { opacity: 0 }, to: { opacity: 1 } } }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, color: '#fff', fontFamily: 'monospace' }}>0{i + 1}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#111', lineHeight: 1.2 }}>{s.title}</Typography>
                      <Typography variant="caption" sx={{ color: '#999' }}>{s.time}</Typography>
                    </Box>
                  </Stack>
                  <Typography variant="body2" sx={{ color: '#666', lineHeight: 1.7, mb: 2.5 }}>{s.desc}</Typography>
                  <Stack spacing={1}>
                    {s.points.map((p) => (
                      <Stack direction="row" spacing={1} alignItems="center" key={p}>
                        <CheckIcon sx={{ fontSize: 16, color: '#111' }} />
                        <Typography variant="body2" sx={{ color: '#444' }}>{p}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Stack direction="row" spacing={1.5} sx={{ mt: 3 }}>
                    {i > 0 && <Button variant="outlined" onClick={() => setDemoStep(i - 1)} sx={{ borderColor: '#ccc', color: '#555', textTransform: 'none', borderRadius: 2, minHeight: 42, px: 2.5, flex: { xs: 1, sm: 'none' } }}>Back</Button>}
                    {i < 3 ? (
                      <Button variant="contained" onClick={() => setDemoStep(i + 1)} endIcon={<ArrowIcon />} sx={{ bgcolor: '#111', color: '#fff', textTransform: 'none', borderRadius: 2, minHeight: 42, px: 2.5, boxShadow: 'none', flex: { xs: 2, sm: 'none' }, '&:hover': { bgcolor: '#333' } }}>Next Step</Button>
                    ) : (
                      <Button variant="contained" onClick={() => navigate('/register')} endIcon={<ArrowIcon />} sx={{ bgcolor: '#8bc34a', color: '#fff', textTransform: 'none', borderRadius: 2, minHeight: 42, px: 2.5, fontWeight: 700, boxShadow: 'none', flex: { xs: 2, sm: 'none' }, '&:hover': { bgcolor: '#7cb342' } }}>Start Free Trial</Button>
                    )}
                  </Stack>
                </Box>
              ))}
            </Grid>

            {/* Right: mock screen */}
            <Grid item xs={12} md={7}>
              <Paper elevation={8} sx={{ borderRadius: 3, overflow: 'hidden', border: '1px solid #e0e0e0' }}>
                <Box sx={{ px: 2, py: 0.75, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0', display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ff5f57' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#ffbd2e' }} />
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: '#28c840' }} />
                  <Box sx={{ flex: 1, ml: 1, px: 1.5, py: 0.3, bgcolor: '#fff', borderRadius: 0.5, border: '1px solid #e0e0e0' }}>
                    <Typography variant="caption" sx={{ color: '#999', fontSize: '0.65rem' }}>
                      {demoStep === 0 ? 'schoolbricks.app/register' : 'schoolbricks.app/dashboard'}
                    </Typography>
                  </Box>
                </Box>

                {/* Step 0: Registration */}
                {demoStep === 0 && (
                  <Box sx={{ p: 3 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#111', mb: 2.5 }}>Register Your School</Typography>
                    {[
                      { label: 'School Name', val: 'Greenfield Academy' },
                      { label: 'Address', val: '12 Admiralty Way, Lekki, Lagos' },
                      { label: 'Owner Email', val: 'admin@greenfield.ng' },
                      { label: 'Calendar', val: '3-Term System' },
                    ].map((f) => (
                      <Box key={f.label} sx={{ mb: 1.5 }}>
                        <Typography variant="caption" sx={{ color: '#999', fontSize: '0.6rem' }}>{f.label}</Typography>
                        <Box sx={{ px: 1.5, py: 0.75, bgcolor: '#f9f9f9', border: '1px solid #e8e8e8', borderRadius: 1.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: '#111', fontSize: '0.85rem' }}>{f.val}</Typography>
                        </Box>
                      </Box>
                    ))}
                    <Paper elevation={0} sx={{ p: 1.5, bgcolor: '#e8f5e9', borderRadius: 2, mt: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CheckIcon sx={{ fontSize: 18, color: '#2e7d32' }} />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#2e7d32' }}>Registered! School ID: <strong>GFA-2025-0847</strong></Typography>
                      </Stack>
                    </Paper>
                  </Box>
                )}

                {/* Step 1: Classes */}
                {demoStep === 1 && (
                  <Box sx={{ display: 'flex', minHeight: 360 }}>
                    <Box sx={{ width: 140, bgcolor: '#111', py: 2, px: 1.5, display: { xs: 'none', sm: 'block' } }}>
                      <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, display: 'block', mb: 2, px: 0.5 }}>SchoolBricks</Typography>
                      {['Dashboard', 'Students', 'Teachers', 'Classes'].map((item, i) => (
                        <Box key={item} sx={{ px: 1, py: 0.5, borderRadius: 1, mb: 0.25, bgcolor: i === 3 ? 'rgba(255,255,255,0.15)' : 'transparent' }}>
                          <Typography variant="caption" sx={{ color: i === 3 ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>{item}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <Box sx={{ flex: 1, p: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#111', mb: 1.5 }}>Classes</Typography>
                      {[
                        { name: 'JSS 1A', teacher: 'Mrs. Okonkwo', n: 42 },
                        { name: 'JSS 2B', teacher: 'Mr. Adeyemi', n: 38 },
                        { name: 'SS 1A', teacher: 'Mrs. Balogun', n: 45 },
                        { name: 'SS 2A', teacher: 'Mr. Ibrahim', n: 40 },
                        { name: 'SS 3A', teacher: 'Mrs. Nwosu', n: 36 },
                      ].map((c) => (
                        <Box key={c.name} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75, px: 1, borderBottom: '1px solid #f0f0f0' }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#111', fontSize: '0.75rem' }}>{c.name}</Typography>
                            <Typography variant="caption" sx={{ color: '#999', fontSize: '0.55rem' }}>{c.teacher}</Typography>
                          </Box>
                          <Chip label={`${c.n} students`} size="small" sx={{ fontSize: '0.6rem', height: 20, bgcolor: '#f5f5f5' }} />
                        </Box>
                      ))}
                      <Box sx={{ mt: 1.5, p: 1, bgcolor: '#e8f5e9', borderRadius: 1.5 }}>
                        <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 600 }}>5 classes created — 201 students assigned</Typography>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* Step 2: Students import */}
                {demoStep === 2 && (
                  <Box sx={{ display: 'flex', minHeight: 360 }}>
                    <Box sx={{ width: 140, bgcolor: '#111', py: 2, px: 1.5, display: { xs: 'none', sm: 'block' } }}>
                      <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, display: 'block', mb: 2, px: 0.5 }}>SchoolBricks</Typography>
                      {['Dashboard', 'Students', 'Teachers', 'Classes'].map((item, i) => (
                        <Box key={item} sx={{ px: 1, py: 0.5, borderRadius: 1, mb: 0.25, bgcolor: i === 1 ? 'rgba(255,255,255,0.15)' : 'transparent' }}>
                          <Typography variant="caption" sx={{ color: i === 1 ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>{item}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <Box sx={{ flex: 1, p: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#111', mb: 1.5 }}>Import Students</Typography>
                      <Paper elevation={0} sx={{ p: 1.5, border: '2px dashed #1976d2', borderRadius: 2, textAlign: 'center', bgcolor: '#f0f7ff', mb: 1.5 }}>
                        <Typography variant="caption" sx={{ fontWeight: 600, color: '#1976d2' }}>students_2025.csv</Typography>
                        <Typography variant="caption" sx={{ color: '#888', fontSize: '0.55rem', display: 'block' }}>271 records processed</Typography>
                      </Paper>
                      {[
                        { name: 'Adaeze Okafor', adm: 'GFA/2025/001', cls: 'JSS 1A' },
                        { name: 'Tunde Bakare', adm: 'GFA/2025/002', cls: 'JSS 1A' },
                        { name: 'Fatima Abdullahi', adm: 'GFA/2025/003', cls: 'JSS 2B' },
                        { name: 'Chinedu Eze', adm: 'GFA/2025/004', cls: 'SS 1A' },
                      ].map((s) => (
                        <Box key={s.adm} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5, px: 1, borderBottom: '1px solid #f0f0f0' }}>
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#111', fontSize: '0.72rem' }}>{s.name}</Typography>
                            <Typography variant="caption" sx={{ color: '#999', fontSize: '0.5rem' }}>{s.adm}</Typography>
                          </Box>
                          <Chip label={s.cls} size="small" sx={{ fontSize: '0.55rem', height: 18, bgcolor: '#f5f5f5' }} />
                        </Box>
                      ))}
                      <Box sx={{ mt: 1, p: 1, bgcolor: '#e8f5e9', borderRadius: 1.5 }}>
                        <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 600 }}>271 imported · 0 errors</Typography>
                      </Box>
                    </Box>
                  </Box>
                )}

                {/* Step 3: Live dashboard */}
                {demoStep === 3 && (
                  <Box sx={{ display: 'flex', minHeight: 360 }}>
                    <Box sx={{ width: 140, bgcolor: '#111', py: 2, px: 1.5, display: { xs: 'none', sm: 'block' } }}>
                      <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, display: 'block', mb: 2, px: 0.5 }}>SchoolBricks</Typography>
                      {['Dashboard', 'Students', 'Teachers', 'Classes', 'Attendance', 'Exams', 'Fees', 'Payments'].map((item, i) => (
                        <Box key={item} sx={{ px: 1, py: 0.5, borderRadius: 1, mb: 0.25, bgcolor: i === 0 ? 'rgba(255,255,255,0.15)' : 'transparent' }}>
                          <Typography variant="caption" sx={{ color: i === 0 ? '#fff' : 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>{item}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <Box sx={{ flex: 1, p: 2, bgcolor: '#fafafa' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: '#111', display: 'block', mb: 0.25 }}>Greenfield Academy's Dashboard</Typography>
                      <Typography variant="caption" sx={{ color: '#999', display: 'block', mb: 1.5, fontSize: '0.6rem' }}>2025/2026 · First Term · GFA-2025-0847</Typography>
                      <Grid container spacing={1}>
                        {[
                          { label: 'Students', value: '271', color: '#e3f2fd' },
                          { label: 'Teachers', value: '18', color: '#e8f5e9' },
                          { label: 'Fees', value: '\u20A60', color: '#fff3e0' },
                          { label: 'Attendance', value: '--', color: '#f3e5f5' },
                        ].map((c) => (
                          <Grid item xs={6} key={c.label}>
                            <Paper elevation={0} sx={{ p: 1, borderRadius: 1.5, border: '1px solid #eee', bgcolor: c.color }}>
                              <Typography variant="caption" sx={{ color: '#888', fontSize: '0.6rem' }}>{c.label}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#111', fontSize: '0.8rem' }}>{c.value}</Typography>
                            </Paper>
                          </Grid>
                        ))}
                      </Grid>
                      <Paper elevation={0} sx={{ p: 1.5, mt: 1.5, bgcolor: '#111', borderRadius: 2, color: '#fff' }}>
                        <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>You're live!</Typography>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.6rem' }}>
                          Attendance, invoices, payments, reports — all operational.
                        </Typography>
                      </Paper>
                    </Box>
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>

          <Box sx={{ textAlign: 'center', mt: 5 }}>
            <Typography variant="body1" sx={{ color: '#111', fontWeight: 700 }}>Total setup time: under 15 minutes.</Typography>
            <Typography variant="body2" sx={{ color: '#999' }}>No IT department. No training. No consultants.</Typography>
          </Box>
        </Container>
      </Box>

      {/* ══════════════ Book a Walkthrough ══════════════ */}
      <Box sx={{ py: { xs: 4, md: 6 } }}>
        <Container maxWidth="md">
          <Paper elevation={0} sx={{ p: { xs: 3, md: 4 }, borderRadius: 3, border: '1px solid #e0e0e0' }}>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={7}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <VideocamIcon sx={{ fontSize: 18, color: '#999' }} />
                  <Typography variant="overline" sx={{ color: '#999', letterSpacing: 2, fontWeight: 600 }}>WANT A LIVE DEMO?</Typography>
                </Stack>
                <Typography variant="h5" sx={{ fontWeight: 800, color: '#111', mb: 1.5, lineHeight: 1.3 }}>
                  Book a free 30-minute walkthrough on Google Meet.
                </Typography>
                <Typography variant="body2" sx={{ color: '#666', lineHeight: 1.7 }}>
                  We'll show you the dashboard, answer your questions, and help you decide if SchoolBricks is the right fit for your school.
                </Typography>
              </Grid>
              <Grid item xs={12} md={5} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                <Button variant="contained" size="large" onClick={() => navigate('/register')} endIcon={<ArrowIcon />}
                  sx={{ bgcolor: '#111', color: '#fff', textTransform: 'none', borderRadius: 2, px: 4, py: 1.25, fontWeight: 600, width: { xs: '100%', md: 'auto' }, '&:hover': { bgcolor: '#333' } }}>
                  Book a Walkthrough
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Container>
      </Box>

      {/* ══════════════ About ══════════════ */}
      <Box id="about" sx={{ py: { xs: 7, md: 12 }, ...anchorOffset }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', mb: 2, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
              We're building the operating system for African schools
            </Typography>
            <Typography variant="body1" sx={{ color: '#666', lineHeight: 1.8, maxWidth: 560, mx: 'auto' }}>
              SchoolBricks was born from a simple observation: schools spend too much time on paperwork and not enough on education. We're a team of educators and engineers building the most intuitive, affordable school management platform for schools across Africa.
            </Typography>
          </Box>
          <Grid container spacing={{ xs: 1.5, md: 3 }}>
            {[
              { num: '500+', label: 'Schools onboarded', sub: 'Across Nigeria and growing' },
              { num: '10hrs', label: 'Saved per week', sub: 'On average, per school admin' },
              { num: '90%', label: 'Fewer payment disputes', sub: 'With digital receipts & tracking' },
              { num: '15min', label: 'Average setup time', sub: 'From signup to first student' },
            ].map((stat) => (
              <Grid item xs={6} md={3} key={stat.label}>
                <Box sx={{ textAlign: 'center', height: '100%', p: { xs: 2, md: 0 }, borderRadius: 3, bgcolor: { xs: '#f7f8f5', md: 'transparent' } }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: { xs: '#0d3b2e', md: '#111' }, mb: 0.5 }}>{stat.num}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#444', mb: 0.25 }}>{stat.label}</Typography>
                  <Typography variant="caption" sx={{ color: '#999' }}>{stat.sub}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ FAQ ══════════════ */}
      <Box id="faq" sx={{ py: { xs: 7, md: 12 }, bgcolor: '#fafafa', ...anchorOffset }}>
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', textAlign: 'center', mb: { xs: 3, md: 6 }, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
            Questions
          </Typography>
          {faqs.map((faq) => (
            <Accordion key={faq.q} elevation={0} disableGutters
              sx={{ bgcolor: 'transparent', borderBottom: '1px solid #e0e0e0', '&:before': { display: 'none' }, '&.Mui-expanded': { margin: 0 } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#999' }} />} sx={{ px: 0, py: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 600, color: '#111', fontSize: { xs: '0.95rem', md: '1rem' }, pr: 1 }}>{faq.q}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 0, pb: 2.5 }}>
                <Typography variant="body2" sx={{ color: '#666', lineHeight: 1.7 }}>{faq.a}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Container>
      </Box>

      {/* ══════════════ Contact ══════════════ */}
      <Box id="contact" sx={{ py: { xs: 7, md: 12 }, ...anchorOffset }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: { xs: 4, md: 6 } }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', mb: 1.5, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
              Get in touch
            </Typography>
            <Typography variant="body1" sx={{ color: '#888', maxWidth: 440, mx: 'auto' }}>
              Have questions? Want a personalised demo? We'd love to hear from you.
            </Typography>
          </Box>
          <Grid container spacing={4}>
            <Grid item xs={12} md={5}>
              <Stack spacing={{ xs: 1.5, md: 3 }}>
                {[
                  { icon: <EmailIcon sx={{ fontSize: 20 }} />, title: 'Email', lines: [{ text: 'hello@schoolbricks.app', href: 'mailto:hello@schoolbricks.app' }, { text: 'support@schoolbricks.app', href: 'mailto:support@schoolbricks.app' }] },
                  { icon: <PhoneIcon sx={{ fontSize: 20 }} />, title: 'Phone', lines: [{ text: '0706 110 2797', href: 'tel:+2347061102797' }, { text: 'Mon - Fri, 8am - 6pm WAT' }] },
                  { icon: <LocationIcon sx={{ fontSize: 20 }} />, title: 'Office', lines: [{ text: 'Lagos, Nigeria' }, { text: 'Serving schools across Africa' }] },
                ].map((c) => (
                  <Stack direction="row" spacing={2} key={c.title} alignItems="flex-start"
                    sx={{ p: { xs: 2, md: 0 }, borderRadius: 3, border: { xs: '1px solid #eee', md: 'none' } }}>
                    <Box sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: 2, bgcolor: '#f1f8e9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#558b2f' }}>{c.icon}</Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#111' }}>{c.title}</Typography>
                      {c.lines.map((l) => l.href ? (
                        <Typography key={l.text} variant="body2" component="a" href={l.href}
                          sx={{ display: 'block', color: '#2e7d32', fontWeight: 500, textDecoration: 'none', py: { xs: 0.25, md: 0 }, '&:hover': { textDecoration: 'underline' } }}>
                          {l.text}
                        </Typography>
                      ) : (
                        <Typography key={l.text} variant="body2" sx={{ color: '#888' }}>{l.text}</Typography>
                      ))}
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={7}>
              <Paper elevation={0} sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 3, border: '1px solid #e0e0e0', bgcolor: '#fff' }}>
                {contactSent && <Alert severity="success" sx={{ mb: 2 }}>Thank you! We'll get back to you within 24 hours.</Alert>}
                <Box component="form" onSubmit={(e: React.FormEvent) => { e.preventDefault(); setContactSent(true); setContactForm({ name: '', email: '', school: '', message: '' }) }}>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Your Name" required size="small" value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField fullWidth label="Email" required type="email" size="small" value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth label="School Name" size="small" value={contactForm.school} onChange={(e) => setContactForm({ ...contactForm, school: e.target.value })} />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth label="Message" required multiline rows={4} size="small" value={contactForm.message} onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })} />
                    </Grid>
                    <Grid item xs={12}>
                      <Button type="submit" variant="contained" size="large" endIcon={<SendIcon />}
                        sx={{ bgcolor: '#111', color: '#fff', textTransform: 'none', borderRadius: 2, px: 4, py: 1.25, fontWeight: 600, width: { xs: '100%', sm: 'auto' }, '&:hover': { bgcolor: '#333' } }}>
                        Send Message
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ Yellow banner ══════════════ */}
      <Box sx={{ py: { xs: 3, md: 4 }, bgcolor: '#fbc02d', color: '#111', textAlign: 'center' }}>
        <Container maxWidth="md">
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5, fontSize: { xs: '1rem', md: '1.3rem' } }}>
            Schools using SchoolBricks save 10 hours a week on admin work.
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.85 }}>
            Fees, attendance, report cards, and parent messages — all in one place.
          </Typography>
        </Container>
      </Box>

      {/* ══════════════ CTA ══════════════ */}
      <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: '#111', color: '#fff', textAlign: 'center' }}>
        <Container maxWidth="sm">
          <Typography variant="h3" sx={{ fontWeight: 800, mb: 2, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
            Your school's operations should run like a system, not a scramble.
          </Typography>
          <Typography variant="body1" sx={{ mb: 4, opacity: 0.7 }}>
            Join schools already using SchoolBricks to save time, reduce errors, and focus on education.
          </Typography>
          <Button variant="contained" size="large" onClick={() => navigate('/register')} endIcon={<ArrowIcon />}
            sx={{ bgcolor: '#8bc34a', color: '#fff', textTransform: 'none', px: 5, py: 1.5, fontWeight: 700, borderRadius: 2, width: { xs: '100%', sm: 'auto' }, boxShadow: 'none', '&:hover': { bgcolor: '#7cb342' } }}>
            Start 14-Day Free Trial
          </Button>
          <Typography variant="caption" sx={{ display: 'block', mt: 2, opacity: 0.5 }}>No card required. Set up in under 10 minutes.</Typography>
        </Container>
      </Box>

      {/* ══════════════ Footer ══════════════ */}
      <Box sx={{ py: 5, bgcolor: '#111', color: 'rgba(255,255,255,0.5)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#fff', mb: 1 }}>SchoolBricks</Typography>
              <Typography variant="body2" sx={{ maxWidth: 240 }}>
                The modern school management platform. Simplifying education administration for schools of every size.
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>Product</Typography>
              <Stack spacing={{ xs: 0, md: 0.5 }}>
                {[{ label: 'Features', href: '#features' }, { label: 'Demo', href: '#demo' }, { label: 'Pricing', href: '#pricing' }, { label: 'FAQ', href: '#faq' }].map((l) => (
                  <Typography key={l.label} variant="body2" component="a" href={l.href} sx={{ textDecoration: 'none', color: 'rgba(255,255,255,0.5)', py: { xs: 1, md: 0 }, '&:hover': { color: '#fff' } }}>{l.label}</Typography>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>Company</Typography>
              <Stack spacing={{ xs: 0, md: 0.5 }}>
                {[{ label: 'About', href: '#about' }, { label: 'Contact', href: '#contact' }, { label: 'Blog', href: '#' }, { label: 'Careers', href: '#' }].map((l) => (
                  <Typography key={l.label} variant="body2" component="a" href={l.href} sx={{ textDecoration: 'none', color: 'rgba(255,255,255,0.5)', py: { xs: 1, md: 0 }, '&:hover': { color: '#fff' } }}>{l.label}</Typography>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>Legal</Typography>
              <Stack spacing={{ xs: 0, md: 0.5 }}>
                {['Privacy Policy', 'Terms of Service', 'NDPR Compliance'].map((l) => (
                  <Typography key={l} variant="body2" sx={{ py: { xs: 1, md: 0 }, '&:hover': { color: '#fff' }, cursor: 'pointer' }}>{l}</Typography>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>Get Started</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>Register your school today.</Typography>
              <Button variant="outlined" onClick={() => navigate('/register')}
                sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', textTransform: 'none', borderRadius: 2, minHeight: 42, px: 2.5, '&:hover': { borderColor: '#fff' } }}>
                Register Now
              </Button>
            </Grid>
          </Grid>
          <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.08)' }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography variant="caption">&copy; {new Date().getFullYear()} SchoolBricks. All rights reserved.</Typography>
            <Typography variant="caption">Built with care for Nigerian schools.</Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}
