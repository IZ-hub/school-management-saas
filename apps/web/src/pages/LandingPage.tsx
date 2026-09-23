import { useState } from 'react'
import {
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
  ToggleButton,
  ToggleButtonGroup,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
    desc: 'Add your school details, create classes, set up terms and sessions. Import existing student data or start fresh. No IT team needed — if you can use WhatsApp, you can set up Schoolful LMS.',
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
  { code: 'SYS-01', icon: <PeopleIcon sx={{ fontSize: 28, color: '#111' }} />, title: 'Student Management', desc: 'Profiles, enrollment, class rosters, and student lists imported from Excel.' },
  { code: 'SYS-02', icon: <CreditIcon sx={{ fontSize: 28, color: '#111' }} />, title: 'Fee Collection', desc: 'Fee types, termly invoices, and payments you can see the moment they clear.' },
  { code: 'SYS-03', icon: <ReportIcon sx={{ fontSize: 28, color: '#111' }} />, title: 'Report Cards', desc: 'Generated from grades, downloaded as PDF. Per student, per class, per term.' },
  { code: 'SYS-04', icon: <AttendIcon sx={{ fontSize: 28, color: '#111' }} />, title: 'Attendance', desc: 'Mark attendance daily. Track patterns per student and per class.' },
]

/* ─── Pricing data ─── */
const pricingData = {
  monthly: [
    { name: 'Starter', sub: 'Up to 150 students', price: '\u20A629,000', period: '/mo', highlighted: false, features: ['Paystack payments \u2014 no chasing parents', 'Unlimited WhatsApp reminders, invoices & receipts', 'All-school broadcasts: \u20A6150/parent reached', 'See every payment the moment it clears', 'Student & staff management', 'Email notifications', 'Import your whole student list from Excel'] },
    { name: 'Growth', sub: 'Up to 500 students', price: '\u20A686,000', period: '/mo', highlighted: true, features: ['Everything in Starter, plus:', '4 all-school broadcasts/term', 'Additional: \u20A6100/parent reached', 'SMS notifications', 'Attendance tracking', 'PDF report cards'] },
    { name: 'Scale', sub: 'Up to 1,000 students', price: '\u20A6145,000', period: '/mo', highlighted: false, features: ['Everything in Growth, plus:', '8 all-school broadcasts/term', 'Additional: \u20A680/parent reached', 'AI report card comments', 'AI spots unusual fee payments'] },
    { name: 'Professional', sub: 'Up to 2,000 students', price: '\u20A6230,000', period: '/mo', highlighted: false, features: ['Everything in Scale, plus:', '12 all-school broadcasts/term', 'Additional: \u20A660/parent reached', 'Multi-campus support', 'Smart search \u2014 just type what you\'re looking for'] },
  ],
  termly: [
    { name: 'Starter', sub: 'Up to 150 students', price: '\u20A675,000', period: '/term', highlighted: false, features: ['Paystack payments \u2014 no chasing parents', 'Unlimited WhatsApp reminders, invoices & receipts', 'All-school broadcasts: \u20A6150/parent reached', 'See every payment the moment it clears', 'Student & staff management', 'Email notifications', 'Import your whole student list from Excel'] },
    { name: 'Growth', sub: 'Up to 500 students', price: '\u20A6220,000', period: '/term', highlighted: true, features: ['Everything in Starter, plus:', '4 all-school broadcasts/term', 'Additional: \u20A6100/parent reached', 'SMS notifications', 'Attendance tracking', 'PDF report cards'] },
    { name: 'Scale', sub: 'Up to 1,000 students', price: '\u20A6380,000', period: '/term', highlighted: false, features: ['Everything in Growth, plus:', '8 all-school broadcasts/term', 'Additional: \u20A680/parent reached', 'AI report card comments', 'AI spots unusual fee payments'] },
    { name: 'Professional', sub: 'Up to 2,000 students', price: '\u20A6600,000', period: '/term', highlighted: false, features: ['Everything in Scale, plus:', '12 all-school broadcasts/term', 'Additional: \u20A660/parent reached', 'Multi-campus support', 'Smart search \u2014 just type what you\'re looking for'] },
  ],
  annual: [
    { name: 'Starter', sub: 'Up to 150 students', price: '\u20A6196,000', period: '/yr', highlighted: false, features: ['Paystack payments \u2014 no chasing parents', 'Unlimited WhatsApp reminders, invoices & receipts', 'All-school broadcasts: \u20A6150/parent reached', 'See every payment the moment it clears', 'Student & staff management', 'Email notifications', 'Import your whole student list from Excel'] },
    { name: 'Growth', sub: 'Up to 500 students', price: '\u20A6585,000', period: '/yr', highlighted: true, features: ['Everything in Starter, plus:', '4 all-school broadcasts/term', 'Additional: \u20A6100/parent reached', 'SMS notifications', 'Attendance tracking', 'PDF report cards'] },
    { name: 'Scale', sub: 'Up to 1,000 students', price: '\u20A6990,000', period: '/yr', highlighted: false, features: ['Everything in Growth, plus:', '8 all-school broadcasts/term', 'Additional: \u20A680/parent reached', 'AI report card comments', 'AI spots unusual fee payments'] },
    { name: 'Professional', sub: 'Up to 2,000 students', price: '\u20A61,560,000', period: '/yr', highlighted: false, features: ['Everything in Scale, plus:', '12 all-school broadcasts/term', 'Additional: \u20A660/parent reached', 'Multi-campus support', 'Smart search \u2014 just type what you\'re looking for'] },
  ],
}

/* ─── Enterprise features ─── */
const enterpriseFeatures = [
  'Unlimited all-school broadcasts',
  'Custom report card templates',
  'Onboarding & data migration included',
  'Quarterly business reviews',
  'One secure login for your whole team, plus connections to your other tools',
  'White-labeled parent app',
  'Dedicated account manager',
  'Custom integrations and a written service guarantee',
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
  { q: 'What types of schools is Schoolful LMS for?', a: 'Schoolful LMS is built for nursery, primary, and secondary schools in Nigeria. Whether you run a single campus or a group of schools, our platform adapts to your structure \u2014 classes, terms, fee types, and all.' },
  { q: 'How long does setup take?', a: 'Most schools are fully set up in under 15 minutes. Just add your school details, create your classes, and start enrolling students. You can also import your existing student list from Excel.' },
  { q: 'Do parents need to download an app?', a: 'No. Parents receive invoices, reminders, receipts, and report card alerts via WhatsApp and email. No app download required \u2014 we meet parents where they already are.' },
  { q: 'How do parents pay fees?', a: 'Parents can pay via bank transfer, card, or USSD through our integrated Paystack payment gateway. Every payment is recorded instantly in your dashboard \u2014 no manual reconciliation needed.' },
  { q: "Is my school's data secure?", a: "Yes. Each school's data is completely isolated from every other school. We use industry-standard encryption, secure cloud infrastructure, and comply with Nigeria's Data Protection Regulation (NDPR)." },
  { q: 'Can I move from another school management tool?', a: 'Absolutely. We support data import from Excel and CSV files. Our support team can also help you migrate your existing records during onboarding.' },
  { q: 'What happens after the 30-day pilot?', a: 'After your pilot ends, you choose a plan that fits your school. All your data from the pilot is preserved \u2014 nothing is lost. If you decide not to continue, you can export your data at any time.' },
  { q: 'What does the pilot include?', a: 'The 30-day pilot gives you full access to all features on the Growth plan. No credit card required. Set up your school, add students, track fees, and see if Schoolful LMS is right for you.' },
  { q: "What's the difference between transactional and broadcast WhatsApp?", a: 'Transactional messages are automatic \u2014 fee reminders, payment receipts, report card alerts. These are unlimited on all paid plans. Broadcasts are custom messages you compose and send to all parents (e.g. "School resumes Monday"). Each broadcast is billed per parent reached.' },
]

export default function LandingPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState(0)
  const [demoStep, setDemoStep] = useState(0)
  const [pricingPeriod, setPricingPeriod] = useState<'monthly' | 'termly' | 'annual'>('monthly')
  const [contactForm, setContactForm] = useState({ name: '', email: '', school: '', message: '' })
  const [contactSent, setContactSent] = useState(false)

  const currentPlans = pricingData[pricingPeriod]

  return (
    <Box sx={{ width: '100%', overflow: 'hidden', bgcolor: '#fff' }}>

      {/* ══════════════ Navbar ══════════════ */}
      <Box component="nav" sx={{ position: 'sticky', top: 0, zIndex: 1100, bgcolor: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #eee' }}>
        <Container maxWidth="lg">
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ py: 1.5 }}>
            <Box sx={{ cursor: 'pointer' }} onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <Typography variant="h6" sx={{ fontWeight: 800, color: '#111', letterSpacing: '-0.5px', lineHeight: 1.1 }}>
                Schoolful LMS
              </Typography>
              <Typography variant="caption" sx={{ color: '#888', fontSize: '0.65rem', letterSpacing: '0.5px' }}>
                Everything School. One Platform.
              </Typography>
            </Box>

            <Stack direction="row" spacing={0.5} alignItems="center" sx={{ display: { xs: 'none', md: 'flex' } }}>
              <Button sx={{ color: '#555', textTransform: 'none', fontWeight: 500 }} href="#features">Features</Button>
              <Button sx={{ color: '#555', textTransform: 'none', fontWeight: 500 }} href="#demo">Demo</Button>
              <Button sx={{ color: '#555', textTransform: 'none', fontWeight: 500 }} href="#pricing">Pricing</Button>
              <Button sx={{ color: '#555', textTransform: 'none', fontWeight: 500 }} href="#about">About</Button>
              <Button sx={{ color: '#555', textTransform: 'none', fontWeight: 500 }} href="#contact">Contact</Button>
              <Button sx={{ color: '#555', textTransform: 'none', fontWeight: 500 }} onClick={() => navigate('/login')}>Sign In</Button>
              <Button variant="contained" onClick={() => navigate('/register')}
                sx={{ bgcolor: '#111', color: '#fff', textTransform: 'none', borderRadius: 2, fontWeight: 600, px: 2.5, '&:hover': { bgcolor: '#333' } }}>
                Get Started
              </Button>
            </Stack>

            <Stack direction="row" spacing={1} sx={{ display: { xs: 'flex', md: 'none' } }}>
              <Button size="small" sx={{ color: '#555', textTransform: 'none' }} onClick={() => navigate('/login')}>Sign In</Button>
              <Button variant="contained" size="small" onClick={() => navigate('/register')}
                sx={{ bgcolor: '#111', color: '#fff', textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#333' } }}>
                Get Started
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      {/* ══════════════ Hero Banner ══════════════ */}
      <Box sx={{ position: 'relative', overflow: 'hidden', bgcolor: '#0d3b2e', color: '#fff' }}>
        {/* Background shapes */}
        <Box sx={{ position: 'absolute', top: -120, right: -80, width: 420, height: 420, borderRadius: '50%', bgcolor: 'rgba(139,195,74,0.12)', zIndex: 0 }} />
        <Box sx={{ position: 'absolute', bottom: -100, left: -60, width: 320, height: 320, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', zIndex: 0 }} />
        <Box sx={{ position: 'absolute', top: '40%',nleft: '60%', width: 160, height: 160, borderRadius: '50%', bgcolor: 'rgba(139,195,74,0.2)', zIndex: 0 }} />

        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 1, py: { xs: 6, md: 10 } }}>
          <Grid container spacing={{ xs: 4, md: 8 }} alignItems="center">
            <Grid item xs={12} md={5}>
              <Chip label="Everything School. One Platform." size="small" sx={{ mb: 2, bgcolor: 'rgba(139,195,74,0.2)', color: '#dcedc8', fontWeight: 600, border: '1px solid rgba(139,195,74,0.3)' }} />
              <Typography variant="h1" sx={{ fontWeight: 800, fontSize: { xs: '2.2rem', sm: '3rem', md: '3.6rem' }, lineHeight: 1.1, letterSpacing: '-1.5px', mb: 3 }}>
                Online School Management Software
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.8)', fontSize: { xs: '1rem', md: '1.1rem' }, lineHeight: 1.8, mb: 4, maxWidth: 440 }}>
                Run your entire school from one beautiful dashboard. Fees, attendance, gradebooks, parent communication, and timetables — all connected.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
                <Button variant="contained" size="large" onClick={() => navigate('/register')} endIcon={<ArrowIcon />}
                  sx={{ bgcolor: '#8bc34a', color: '#fff', textTransform: 'none', borderRadius: 2, fontWeight: 700, px: 4, py: 1.5, fontSize: '1rem', '&:hover': { bgcolor: '#7cb342' } }}>
                  Sign up for free
                </Button>
                <Button variant="outlined" size="large" href="#demo"
                  sx={{ borderColor: 'rgba(255,255,255,0.5)', color: '#fff', textTransform: 'none', borderRadius: 2, fontWeight: 600, px: 4, py: 1.5, fontSize: '1rem', '&:hover': { bgcolor: 'rgba(255,255,255,0.08)' } }}>
                  Watch demo
                </Button>
              </Stack>
              <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap', gap: 1 }}>
                {['No credit card', 'Setup in 15 minutes', 'Free 30-day pilot'].map((b) => (
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
                    <Typography variant="caption" sx={{ color: '#999', fontSize: '0.65rem' }}>schoolful.app/dashboard</Typography>
                  </Box>
                </Box>
                <Box sx={{ display: 'flex', minHeight: 340, bgcolor: '#fafafa' }}>
                  <Box sx={{ width: 150, bgcolor: '#1b5e20', py: 2, px: 1.5, display: { xs: 'none', sm: 'block' } }}>
                    <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, display: 'block', mb: 2, px: 0.5 }}>Schoolful LMS</Typography>
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
          <Grid container spacing={3}>
            {[
              { icon: <ReportIcon sx={{ fontSize: 28, color: '#8bc34a' }} />, title: 'Gradebook & Reports', desc: 'Customizable gradebook software and automatic report card generation.' },
              { icon: <AttendIcon sx={{ fontSize: 28, color: '#8bc34a' }} />, title: 'Attendance Tracking', desc: 'Classroom and attendance management with real-time notifications.' },
              { icon: <CreditIcon sx={{ fontSize: 28, color: '#8bc34a' }} />, title: 'Fees & Payments', desc: 'Online payments, invoices, receipts, and outstanding balance tracking.' },
              { icon: <PeopleIcon sx={{ fontSize: 28, color: '#8bc34a' }} />, title: 'Student Information', desc: 'Powerful SIS for student records, admissions, and parent portals.' },
              { icon: <NotifIcon sx={{ fontSize: 28, color: '#8bc34a' }} />, title: 'Parent Communication', desc: 'WhatsApp and SMS alerts to keep parents informed instantly.' },
              { icon: <LockIcon sx={{ fontSize: 28, color: '#8bc34a' }} />, title: 'Secure & Private', desc: 'Role-based access and NDPR-aligned data protection for every school.' },
            ].map((f) => (
              <Grid item xs={12} sm={6} md={4} key={f.title}>
                <Paper elevation={0} sx={{ p: 3, height: '100%', borderRadius: 3, border: '1px solid #e0e0e0', bgcolor: '#fff' }}>
                  <Box sx={{ mb: 1.5 }}>{f.icon}</Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#2d3748', mb: 0.75, fontSize: '1.05rem' }}>{f.title}</Typography>
                  <Typography variant="body2" sx={{ color: '#718096', lineHeight: 1.6 }}>{f.desc}</Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ Trust badges ══════════════ */}
      <Box sx={{ py: 3, borderBottom: '1px solid #eee', bgcolor: '#fff' }}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={{ xs: 2, md: 4 }} justifyContent="center" flexWrap="wrap" sx={{ gap: 1.5 }}>
            {[
              { icon: <FlagIcon sx={{ fontSize: 16, color: '#8bc34a' }} />, label: 'Built for Nigerian schools' },
              { icon: <PaymentIcon sx={{ fontSize: 16, color: '#8bc34a' }} />, label: 'Online payments' },
              { icon: <NotifIcon sx={{ fontSize: 16, color: '#8bc34a' }} />, label: 'WhatsApp notifications' },
              { icon: <LockIcon sx={{ fontSize: 16, color: '#8bc34a' }} />, label: 'Your data stays private' },
            ].map((badge) => (
              <Stack key={badge.label} direction="row" spacing={0.75} alignItems="center">
                <Box>{badge.icon}</Box>
                <Typography variant="body2" sx={{ color: '#666', fontWeight: 500, fontSize: { xs: '0.75rem', md: '0.85rem' } }}>{badge.label}</Typography>
              </Stack>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ══════════════ Meet Your Team (Personas) ══════════════ */}
      <Box sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', textAlign: 'center', mb: 2, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
            Every school runs on these three people
          </Typography>
          <Typography variant="body1" sx={{ color: '#888', textAlign: 'center', mb: 8, maxWidth: 500, mx: 'auto' }}>
            Meet your team — and the problems they face every single term.
          </Typography>

          <Stack spacing={10}>
            {personas.map((p) => (
              <Box key={p.role}>
                <Typography variant="overline" sx={{ color: '#999', letterSpacing: 3, fontWeight: 600, display: 'block', mb: 1.5 }}>
                  {p.role}
                </Typography>
                <Typography variant="h4" sx={{ fontWeight: 700, color: '#111', mb: 3, fontSize: { xs: '1.4rem', md: '1.85rem' }, lineHeight: 1.3, maxWidth: 550 }}>
                  {p.quote}
                </Typography>
                <Stack spacing={1.5}>
                  {p.pains.map((pain) => (
                    <Stack direction="row" spacing={1.5} key={pain} alignItems="flex-start">
                      <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#ccc', mt: 1, flexShrink: 0 }} />
                      <Typography variant="body1" sx={{ color: '#666', lineHeight: 1.6 }}>{pain}</Typography>
                    </Stack>
                  ))}
                </Stack>
                <Divider sx={{ mt: 5 }} />
              </Box>
            ))}
          </Stack>
        </Container>
      </Box>

      {/* ══════════════ Transition statement ══════════════ */}
      <Box sx={{ py: { xs: 6, md: 10 }, bgcolor: '#fafafa' }}>
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', textAlign: 'center', fontSize: { xs: '1.5rem', md: '2.25rem' }, letterSpacing: '-1px' }}>
            Schoolful LMS gives each of them a system that works.
          </Typography>
        </Container>
      </Box>

      {/* ══════════════ Features (Tabbed) ══════════════ */}
      <Box id="features" sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Tabs
            value={activeTab}
            onChange={(_, v) => setActiveTab(v)}
            centered
            sx={{
              mb: 6,
              '& .MuiTab-root': { textTransform: 'uppercase', fontWeight: 700, letterSpacing: 2, color: '#999', fontSize: '0.85rem' },
              '& .Mui-selected': { color: '#111' },
              '& .MuiTabs-indicator': { bgcolor: '#111', height: 3 },
            }}
          >
            {featureTabs.map((t) => (
              <Tab key={t.label} label={t.label} />
            ))}
          </Tabs>

          <Grid container spacing={6} alignItems="center">
            {/* Feature mockup */}
            <Grid item xs={12} md={6}>
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
              <Typography variant="overline" sx={{ color: '#1976d2', fontWeight: 700, letterSpacing: 2 }}>
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
      <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: '#fafafa' }}>
        <Container maxWidth="lg">
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', textAlign: 'center', mb: 6, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
            Everything your school runs on
          </Typography>
          <Grid container spacing={0}>
            {systemFeatures.map((sf, idx) => (
              <Grid item xs={12} sm={6} md={3} key={sf.code}>
                <Box
                  sx={{
                    p: 3.5,
                    height: '100%',
                    border: '1px solid #e0e0e0',
                    borderRight: idx < 3 ? { md: 'none' } : '1px solid #e0e0e0',
                    bgcolor: idx === 3 ? '#111' : '#fff',
                    transition: 'background-color 0.3s',
                    '&:hover': { bgcolor: idx === 3 ? '#222' : '#f5f5f5' },
                  }}
                >
                  <Typography variant="caption" sx={{ color: idx === 3 ? 'rgba(255,255,255,0.5)' : '#999', letterSpacing: 2, fontWeight: 600, display: 'block', mb: 2 }}>
                    {sf.code}
                  </Typography>
                  <Box sx={{ mb: 2, color: idx === 3 ? '#fff' : '#111' }}>{sf.icon}</Box>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: idx === 3 ? '#fff' : '#111', mb: 1 }}>
                    {sf.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: idx === 3 ? 'rgba(255,255,255,0.7)' : '#666', lineHeight: 1.6 }}>
                    {sf.desc}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ Pricing ══════════════ */}
      <Box id="pricing" sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', mb: 1.5, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
              Simple pricing. No surprises.
            </Typography>
          </Box>

          {/* Period toggle */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <ToggleButtonGroup
              value={pricingPeriod}
              exclusive
              onChange={(_, v) => v && setPricingPeriod(v)}
              sx={{
                bgcolor: '#f5f5f5', borderRadius: 2,
                '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, px: 3, py: 0.75, border: 'none', borderRadius: '8px !important', color: '#666' },
                '& .Mui-selected': { bgcolor: '#111 !important', color: '#fff !important' },
              }}
            >
              <ToggleButton value="monthly">Monthly</ToggleButton>
              <ToggleButton value="termly">Termly</ToggleButton>
              <ToggleButton value="annual">
                Annual <Chip label="-15%" size="small" sx={{ ml: 0.75, height: 20, fontSize: '0.65rem', bgcolor: '#e8f5e9', color: '#2e7d32', fontWeight: 700 }} />
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          <Typography variant="body2" sx={{ textAlign: 'center', color: '#888', mb: 5 }}>
            First 50 schools: 50% off your first term, any plan.
          </Typography>

          {/* Plan cards */}
          <Grid container spacing={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'hidden' }}>
            {currentPlans.map((plan, idx) => (
              <Grid item xs={12} sm={6} md={3} key={plan.name}>
                <Box sx={{
                  p: 3, height: '100%', display: 'flex', flexDirection: 'column',
                  borderRight: idx < 3 ? { md: '1px solid #e0e0e0' } : 'none',
                  borderBottom: { xs: '1px solid #e0e0e0', md: 'none' },
                  position: 'relative',
                  ...(plan.highlighted ? { border: '2px solid #2e7d32', borderRadius: 0, m: '-1px', zIndex: 1 } : {}),
                }}>
                  {plan.highlighted && (
                    <Chip label="Most Popular" size="small" sx={{ position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%) translateY(-50%)', bgcolor: '#2e7d32', color: '#fff', fontWeight: 700, fontSize: '0.7rem' }} />
                  )}
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#111' }}>{plan.name}</Typography>
                  <Typography variant="body2" sx={{ color: '#888', mb: 1.5 }}>{plan.sub}</Typography>
                  <Stack direction="row" alignItems="baseline" spacing={0.5} sx={{ mb: 2.5 }}>
                    <Typography variant="h4" sx={{ fontWeight: 800, color: '#111', fontSize: '1.75rem' }}>{plan.price}</Typography>
                    <Typography variant="body2" sx={{ color: '#888' }}>{plan.period}</Typography>
                  </Stack>
                  <Divider sx={{ mb: 2 }} />
                  <Stack spacing={1.25} sx={{ flex: 1, mb: 3 }}>
                    {plan.features.map((f) => (
                      <Stack direction="row" spacing={1} alignItems="flex-start" key={f}>
                        <CheckIcon sx={{ fontSize: 16, color: plan.highlighted ? '#2e7d32' : '#111', mt: 0.25, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ color: '#555', fontSize: '0.82rem', lineHeight: 1.5 }}>{f}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                  <Button variant={plan.highlighted ? 'contained' : 'outlined'} fullWidth onClick={() => navigate('/register')}
                    sx={{
                      py: 1.25, borderRadius: 2, fontWeight: 600, textTransform: 'none',
                      ...(plan.highlighted
                        ? { bgcolor: '#111', color: '#fff', '&:hover': { bgcolor: '#333' } }
                        : { borderColor: '#111', color: '#111', '&:hover': { bgcolor: '#f5f5f5' } }),
                    }}>
                    Start 30-Day Pilot
                  </Button>
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* Enterprise section */}
          <Paper elevation={0} sx={{ mt: 4, p: { xs: 3, md: 5 }, bgcolor: '#111', borderRadius: 3, color: '#fff' }}>
            <Grid container spacing={4} alignItems="center">
              <Grid item xs={12} md={4}>
                <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>Enterprise</Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 1.5 }}>2,000+ students</Typography>
                <Typography variant="h4" sx={{ fontWeight: 800, fontFamily: 'monospace' }}>Custom pricing</Typography>
              </Grid>
              <Grid item xs={12} md={5}>
                <Grid container spacing={1}>
                  {enterpriseFeatures.map((f) => (
                    <Grid item xs={12} sm={6} key={f}>
                      <Stack direction="row" spacing={1} alignItems="flex-start">
                        <CheckIcon sx={{ fontSize: 16, color: '#4caf50', mt: 0.25, flexShrink: 0 }} />
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.85)', fontSize: '0.82rem', lineHeight: 1.5 }}>{f}</Typography>
                      </Stack>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
              <Grid item xs={12} md={3} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                <Button variant="outlined" size="large" onClick={() => navigate('/register')}
                  sx={{ borderColor: 'rgba(255,255,255,0.4)', color: '#fff', textTransform: 'none', borderRadius: 2, px: 4, fontWeight: 600, '&:hover': { borderColor: '#fff' } }}>
                  Talk to Sales
                </Button>
              </Grid>
            </Grid>
          </Paper>

          <Typography variant="body2" sx={{ textAlign: 'center', color: '#888', mt: 4, maxWidth: 700, mx: 'auto', lineHeight: 1.7 }}>
            <strong>Transactional messages</strong> (reminders, invoices, receipts, report-card alerts) are <strong>unlimited</strong> on every paid plan.{' '}
            <strong>Broadcasts</strong> are admin-composed all-school messages — 1 broadcast counts as 1 parent reached for billing.
          </Typography>

          <Typography variant="body2" sx={{ textAlign: 'center', color: '#999', mt: 2 }}>
            Start with a 30-day free pilot. No card required.
          </Typography>
        </Container>
      </Box>

      {/* ══════════════ Built for Nigerian schools ══════════════ */}
      <Box sx={{ py: { xs: 8, md: 10 }, bgcolor: '#111' }}>
        <Container maxWidth="lg">
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#fff', textAlign: 'center', mb: 6, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
            Built for how Nigerian schools actually work
          </Typography>
          <Grid container spacing={2}>
            {nigerianValues.map((v, idx) => (
              <Grid item xs={12} sm={6} md={idx < 3 ? 4 : 6} key={v.title}>
                <Box sx={{ p: 3, borderRadius: 2, border: '1px solid rgba(255,255,255,0.15)', height: '100%', borderLeft: '3px solid rgba(255,255,255,0.3)' }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>{v.title}</Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.65)', lineHeight: 1.7 }}>{v.desc}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ Demo — Interactive Setup ══════════════ */}
      <Box id="demo" sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 5 }}>
            <Typography variant="overline" sx={{ color: '#999', letterSpacing: 3, fontWeight: 600 }}>
              INTERACTIVE DEMO
            </Typography>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', mt: 1, mb: 1.5, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
              From sign-up to fully running — in 4 steps
            </Typography>
            <Typography variant="body1" sx={{ color: '#888', maxWidth: 500, mx: 'auto' }}>
              Click through each step to see how Schoolful LMS gets your school ready.
            </Typography>
          </Box>

          {/* Step pills */}
          <Stack direction="row" justifyContent="center" spacing={1} sx={{ mb: 4 }}>
            {['Register', 'Classes', 'Students', 'Live'].map((label, i) => (
              <Chip key={label} label={label} onClick={() => setDemoStep(i)}
                sx={{
                  fontWeight: 600, fontSize: '0.82rem', px: 1, cursor: 'pointer',
                  bgcolor: demoStep === i ? '#111' : '#fff', color: demoStep === i ? '#fff' : '#555',
                  border: demoStep === i ? 'none' : '1px solid #ddd',
                  '&:hover': { bgcolor: demoStep === i ? '#333' : '#f5f5f5' },
                }}
              />
            ))}
          </Stack>

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
                    {i > 0 && <Button variant="outlined" size="small" onClick={() => setDemoStep(i - 1)} sx={{ borderColor: '#ccc', color: '#555', textTransform: 'none', borderRadius: 2 }}>Back</Button>}
                    {i < 3 ? (
                      <Button variant="contained" size="small" onClick={() => setDemoStep(i + 1)} sx={{ bgcolor: '#111', color: '#fff', textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#333' } }}>Next Step</Button>
                    ) : (
                      <Button variant="contained" size="small" onClick={() => navigate('/register')} endIcon={<ArrowIcon />} sx={{ bgcolor: '#111', color: '#fff', textTransform: 'none', borderRadius: 2, '&:hover': { bgcolor: '#333' } }}>Start Your Pilot</Button>
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
                      {demoStep === 0 ? 'schoolful.app/register' : 'schoolful.app/dashboard'}
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
                      <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, display: 'block', mb: 2, px: 0.5 }}>Schoolful LMS</Typography>
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
                      <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, display: 'block', mb: 2, px: 0.5 }}>Schoolful LMS</Typography>
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
                      <Typography variant="caption" sx={{ color: '#fff', fontWeight: 700, display: 'block', mb: 2, px: 0.5 }}>Schoolful LMS</Typography>
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
                  We'll show you the dashboard, answer your questions, and help you decide if Schoolful LMS is the right fit for your school.
                </Typography>
              </Grid>
              <Grid item xs={12} md={5} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                <Button variant="contained" size="large" onClick={() => navigate('/register')} endIcon={<ArrowIcon />}
                  sx={{ bgcolor: '#111', color: '#fff', textTransform: 'none', borderRadius: 2, px: 4, fontWeight: 600, '&:hover': { bgcolor: '#333' } }}>
                  Book a Walkthrough
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Container>
      </Box>

      {/* ══════════════ About ══════════════ */}
      <Box id="about" sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="md">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', mb: 2, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
              We're building the operating system for African schools
            </Typography>
            <Typography variant="body1" sx={{ color: '#666', lineHeight: 1.8, maxWidth: 560, mx: 'auto' }}>
              Schoolful LMS was born from a simple observation: schools spend too much time on paperwork and not enough on education. We're a team of educators and engineers building the most intuitive, affordable school management platform for schools across Africa.
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {[
              { num: '500+', label: 'Schools onboarded', sub: 'Across Nigeria and growing' },
              { num: '10hrs', label: 'Saved per week', sub: 'On average, per school admin' },
              { num: '90%', label: 'Fewer payment disputes', sub: 'With digital receipts & tracking' },
              { num: '15min', label: 'Average setup time', sub: 'From signup to first student' },
            ].map((stat) => (
              <Grid item xs={6} md={3} key={stat.label}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h4" sx={{ fontWeight: 800, color: '#111', mb: 0.5 }}>{stat.num}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 600, color: '#444', mb: 0.25 }}>{stat.label}</Typography>
                  <Typography variant="caption" sx={{ color: '#999' }}>{stat.sub}</Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ══════════════ FAQ ══════════════ */}
      <Box id="faq" sx={{ py: { xs: 8, md: 12 }, bgcolor: '#fafafa' }}>
        <Container maxWidth="md">
          <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', textAlign: 'center', mb: 6, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
            Questions
          </Typography>
          {faqs.map((faq) => (
            <Accordion key={faq.q} elevation={0} disableGutters
              sx={{ bgcolor: 'transparent', borderBottom: '1px solid #e0e0e0', '&:before': { display: 'none' }, '&.Mui-expanded': { margin: 0 } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: '#999' }} />} sx={{ px: 0, py: 1 }}>
                <Typography variant="body1" sx={{ fontWeight: 600, color: '#111' }}>{faq.q}</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 0, pb: 2.5 }}>
                <Typography variant="body2" sx={{ color: '#666', lineHeight: 1.7 }}>{faq.a}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Container>
      </Box>

      {/* ══════════════ Contact ══════════════ */}
      <Box id="contact" sx={{ py: { xs: 8, md: 12 } }}>
        <Container maxWidth="lg">
          <Box sx={{ textAlign: 'center', mb: 6 }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: '#111', mb: 1.5, fontSize: { xs: '1.75rem', md: '2.5rem' }, letterSpacing: '-1px' }}>
              Get in touch
            </Typography>
            <Typography variant="body1" sx={{ color: '#888', maxWidth: 440, mx: 'auto' }}>
              Have questions? Want a personalised demo? We'd love to hear from you.
            </Typography>
          </Box>
          <Grid container spacing={4}>
            <Grid item xs={12} md={5}>
              <Stack spacing={3}>
                {[
                  { icon: <EmailIcon sx={{ fontSize: 20 }} />, title: 'Email', lines: ['hello@schoolful.app', 'support@schoolful.app'] },
                  { icon: <PhoneIcon sx={{ fontSize: 20 }} />, title: 'Phone', lines: ['0706 110 2797', 'Mon - Fri, 8am - 6pm WAT'] },
                  { icon: <LocationIcon sx={{ fontSize: 20 }} />, title: 'Office', lines: ['Lagos, Nigeria', 'Serving schools across Africa'] },
                ].map((c) => (
                  <Stack direction="row" spacing={2} key={c.title} alignItems="flex-start">
                    <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111' }}>{c.icon}</Box>
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#111' }}>{c.title}</Typography>
                      {c.lines.map((l) => <Typography key={l} variant="body2" sx={{ color: '#888' }}>{l}</Typography>)}
                    </Box>
                  </Stack>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} md={7}>
              <Paper elevation={0} sx={{ p: { xs: 3, sm: 4 }, borderRadius: 3, border: '1px solid #e0e0e0', bgcolor: '#fff' }}>
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
                        sx={{ bgcolor: '#111', color: '#fff', textTransform: 'none', borderRadius: 2, px: 4, fontWeight: 600, '&:hover': { bgcolor: '#333' } }}>
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
            Schools using Schoolful LMS save 10 hours a week on admin work.
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
            Join schools already using Schoolful LMS to save time, reduce errors, and focus on education.
          </Typography>
          <Button variant="contained" size="large" onClick={() => navigate('/register')} endIcon={<ArrowIcon />}
            sx={{ bgcolor: '#fff', color: '#111', textTransform: 'none', px: 5, py: 1.5, fontWeight: 700, borderRadius: 2, '&:hover': { bgcolor: '#f5f5f5' } }}>
            Start 30-Day Pilot
          </Button>
          <Typography variant="caption" sx={{ display: 'block', mt: 2, opacity: 0.5 }}>No card required. Set up in under 10 minutes.</Typography>
        </Container>
      </Box>

      {/* ══════════════ Footer ══════════════ */}
      <Box sx={{ py: 5, bgcolor: '#111', color: 'rgba(255,255,255,0.5)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <Container maxWidth="lg">
          <Grid container spacing={4}>
            <Grid item xs={12} md={3}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#fff', mb: 1 }}>Schoolful LMS</Typography>
              <Typography variant="body2" sx={{ maxWidth: 240 }}>
                The modern school management platform. Simplifying education administration for schools of every size.
              </Typography>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>Product</Typography>
              <Stack spacing={0.5}>
                {[{ label: 'Features', href: '#features' }, { label: 'Demo', href: '#demo' }, { label: 'Pricing', href: '#pricing' }, { label: 'FAQ', href: '#faq' }].map((l) => (
                  <Typography key={l.label} variant="body2" component="a" href={l.href} sx={{ textDecoration: 'none', color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>{l.label}</Typography>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>Company</Typography>
              <Stack spacing={0.5}>
                {[{ label: 'About', href: '#about' }, { label: 'Contact', href: '#contact' }, { label: 'Blog', href: '#' }, { label: 'Careers', href: '#' }].map((l) => (
                  <Typography key={l.label} variant="body2" component="a" href={l.href} sx={{ textDecoration: 'none', color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#fff' } }}>{l.label}</Typography>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>Legal</Typography>
              <Stack spacing={0.5}>
                {['Privacy Policy', 'Terms of Service', 'NDPR Compliance'].map((l) => (
                  <Typography key={l} variant="body2" sx={{ '&:hover': { color: '#fff' }, cursor: 'pointer' }}>{l}</Typography>
                ))}
              </Stack>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#fff', mb: 1 }}>Get Started</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>Register your school today.</Typography>
              <Button variant="outlined" size="small" onClick={() => navigate('/register')}
                sx={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', textTransform: 'none', borderRadius: 2, '&:hover': { borderColor: '#fff' } }}>
                Register Now
              </Button>
            </Grid>
          </Grid>
          <Divider sx={{ my: 3, borderColor: 'rgba(255,255,255,0.08)' }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" spacing={1}>
            <Typography variant="caption">&copy; {new Date().getFullYear()} Schoolful LMS. All rights reserved.</Typography>
            <Typography variant="caption">Built with care for Nigerian schools.</Typography>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}
