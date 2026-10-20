import { ReactNode, useEffect } from 'react'
import { Box, Container, Stack, Typography } from '@mui/material'
import { Link } from 'react-router-dom'
import { BrandMark, Wordmark } from '../components/Brand'
import { brand } from '../theme'

const UPDATED = '20 October 2026'
const EMAIL = 'hello@schoolprecise.com'

const C = { ink: '#10241c', body: '#3f4a44', muted: '#5f6a63', cream: '#faf4ea', line: '#e9e0d0', green: '#0e5c43' }

function H2({ children }: { children: ReactNode }) {
  return <Typography component="h2" sx={{ fontWeight: 800, color: C.ink, fontSize: { xs: '1.2rem', md: '1.35rem' }, mt: 4.5, mb: 1.25, letterSpacing: '-0.3px' }}>{children}</Typography>
}
function P({ children }: { children: ReactNode }) {
  return <Typography sx={{ color: C.body, fontSize: '1rem', lineHeight: 1.75, mb: 1.5 }}>{children}</Typography>
}
function UL({ items }: { items: ReactNode[] }) {
  return (
    <Box component="ul" sx={{ m: 0, mb: 1.5, pl: 2.5, color: C.body, '& li': { fontSize: '1rem', lineHeight: 1.7, mb: 0.75 } }}>
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </Box>
  )
}
const Mail = () => <Box component="a" href={`mailto:${EMAIL}`} sx={{ color: C.green, fontWeight: 600 }}>{EMAIL}</Box>

function Privacy() {
  return (
    <>
      <P>
        School Precise is school management software used by schools in Nigeria. This policy explains what personal data the service holds, why, where it is kept, and the
        choices you have. It applies to schools, their staff, parents and guardians, and visitors to schoolprecise.com.
      </P>

      <H2>1. Who is responsible for the data</H2>
      <P>
        <b>Records a school puts into School Precise</b> (students, staff, parents, attendance, results, fees and messages) belong to that school. The school decides what is
        recorded and why, and is the <b>data controller</b>. School Precise holds and processes those records only to provide the service to the school, as its <b>data processor</b>.
      </P>
      <P>
        <b>School Precise is the controller</b> for the details of the people who sign up and pay for the service, messages sent to us through the website or chat, and the
        technical records we keep to run and protect the service.
      </P>
      <P>Questions about a child's records should usually go to the child's school first. You can also contact us at <Mail />.</P>

      <H2>2. What we hold</H2>
      <UL items={[
        <><b>School details:</b> name, address, phone, email, logo, motto, principal's name and term dates.</>,
        <><b>Staff accounts:</b> name, email, role and, for teachers, details the school adds such as phone, qualification and employee number. Passwords are stored only as a one-way hash, never as plain text.</>,
        <><b>Students:</b> name, admission number, date of birth, gender, class, address, and parent or guardian contact details, as entered by the school.</>,
        <><b>School records:</b> attendance, exam scores, report card remarks, class history, fees, discounts, payments and receipts, and messages the school sends to parents.</>,
        <><b>Parent accounts:</b> name, email and phone of parents the school invites to their child's parent page.</>,
        <><b>Messages to us:</b> the name, email and message you send through the contact form or chat, and the page you sent it from.</>,
        <><b>Technical records:</b> sign-in times, and IP addresses used briefly to stop password guessing and abuse, plus error reports used to fix problems.</>,
      ]} />
      <P>We do not collect card or bank details. Online payments are made directly on Paystack's secure page.</P>

      <H2>3. Why we use it</H2>
      <UL items={[
        'To provide the service the school has signed up for: registers, results, report cards, fees, timetables, parent pages and messages.',
        'To keep accounts secure: sign-in, password resets, preventing repeated wrong passwords, and investigating misuse.',
        'To bill schools for their subscription, and to answer questions sent to us.',
        'To fix errors and improve the service.',
      ]} />
      <P>
        We rely on the school's agreement with us (our contract) to process school records, on our legitimate interest in running a secure and working service, and on
        legal obligations where they apply. We do not sell personal data, and we do not use school records for advertising.
      </P>

      <H2>4. Who else handles the data</H2>
      <P>We use a small number of trusted providers, each only for the job described:</P>
      <UL items={[
        <><b>Google Cloud and Firebase</b>: hosting, the database and the servers that run School Precise.</>,
        <><b>Resend</b>: sending password-reset emails and forwarding messages sent to us.</>,
        <><b>Paystack</b>: online fee payments into the school's own Paystack account, and School Precise subscription payments.</>,
        <><b>Termii</b>: text messages, only if a school turns on SMS through its own Termii account.</>,
        <><b>Namecheap</b>: our domain and the forwarding of email sent to {EMAIL}.</>,
      ]} />
      <P>We share data with others only when the law requires it, for example a valid request from a Nigerian authority.</P>

      <H2>5. Where data is kept</H2>
      <P>
        School Precise's database and servers are run by Google Cloud in the <b>United States</b>, and emails are sent through Resend's servers in the European Union. This
        means personal data is transferred outside Nigeria. We do so to use secure, reliable providers, and we rely on their security commitments and contractual safeguards
        to protect it, as Nigerian data protection law allows.
      </P>

      <H2>6. How we protect it</H2>
      <UL items={[
        "Each school's records are kept separate, and every request is checked against the signed-in person's school.",
        'Access depends on role. For example, teachers see only the classes they teach, and parents see only their own children.',
        'Data travels over encrypted connections (HTTPS). Passwords are hashed, and schools’ Paystack and Termii keys are stored encrypted.',
        'Sign-in sessions expire, and repeated wrong passwords are blocked for a while.',
        'The database is backed up every day.',
      ]} />

      <H2>7. How long we keep it</H2>
      <P>
        School records are kept while the school uses School Precise, so that registers, results and receipts stay available. When a school leaves, it can ask for a copy,
        and we delete its records on request. Copies in our daily backups are kept for <b>14 days</b> and then deleted automatically. Messages to us are kept for as long as
        needed to answer them and for our records.
      </P>

      <H2>8. Your rights</H2>
      <P>
        Under the Nigeria Data Protection Act 2023 you can ask to see the personal data held about you, have it corrected, have it deleted, object to or restrict its use,
        and receive a copy. Parents and guardians exercise these rights for their children.
      </P>
      <P>
        For records a school holds, please ask the school; we will help the school respond. For anything else, write to <Mail />. We will reply within 30 days. You may also
        complain to the <b>Nigeria Data Protection Commission</b>.
      </P>

      <H2>9. Children</H2>
      <P>
        Students do not have their own accounts. Their records are entered and managed by their school, and parents see them through the parent page the school sets up.
      </P>

      <H2>10. Browser storage</H2>
      <P>
        We do not use advertising or tracking cookies. Your browser stores only what the service needs: your sign-in session, and the conversation in the support chat so it
        is still there when you come back. Signing out removes your session.
      </P>

      <H2>11. Changes</H2>
      <P>If we change this policy, we will update the date at the top and, for important changes, tell schools through the app or by email.</P>
    </>
  )
}

function Terms() {
  return (
    <>
      <P>
        These terms are the agreement between School Precise and the school that creates an account (the "school"). By registering a school or using School Precise, you
        confirm that you are allowed to act for the school and that the school accepts these terms.
      </P>

      <H2>1. The service</H2>
      <P>
        School Precise provides online tools for running a school: students and classes, attendance, exams, results and report cards, fees and receipts, timetables, staff
        accounts, parent pages and messages. We may improve and change features over time.
      </P>

      <H2>2. Accounts and access</H2>
      <UL items={[
        "The school is responsible for who it invites, the roles it gives them, and removing access when someone leaves.",
        'Keep passwords private, and tell us at once if you think an account has been misused.',
        'Each person must use their own account.',
      ]} />

      <H2>3. The school's data</H2>
      <UL items={[
        'The school owns the records it enters, and is responsible for having the right to record them, including consent or another lawful basis under the Nigeria Data Protection Act 2023.',
        <>We process school records only to provide the service, as described in our <Box component={Link} to="/privacy" sx={{ color: C.green, fontWeight: 600 }}>Privacy Policy</Box>.</>,
        'The school can ask for a copy of its records at any time, and for them to be deleted when it leaves.',
      ]} />

      <H2>4. Price and payment</H2>
      <UL items={[
        <>New schools get a <b>14-day free trial</b> with every feature.</>,
        <>After that, the price is <b>₦1,500 per active student, per term</b>, invoiced at the start of each term and paid online through Paystack. Students who have left or graduated are not counted.</>,
        <>If an invoice is unpaid after a <b>7-day grace period</b>, the school becomes <b>read-only</b> until payment: staff can still view and print everything and parents can still see their children, but records cannot be added or changed. Nothing is deleted.</>,
        'Prices may change; we will give schools notice before a new term begins.',
        'Payments for a term that has started are not refundable, unless the law requires otherwise.',
      ]} />

      <H2>5. Fees paid by parents</H2>
      <P>
        If a school connects its own Paystack account, parents' fee payments go straight to the school's account. The school's relationship with Paystack, and with parents
        about fees and refunds, is the school's own. School Precise does not hold school fees.
      </P>

      <H2>6. Acceptable use</H2>
      <P>Do not use School Precise to break the law, send spam or harmful messages, upload content you have no right to share, or try to access other schools' data or disrupt the service.</P>

      <H2>7. Availability and support</H2>
      <P>
        We work to keep School Precise running and backed up daily, but the service may sometimes be unavailable for maintenance or reasons beyond our control. Support is
        available at <Mail /> and through the chat on the website.
      </P>

      <H2>8. Liability</H2>
      <P>
        The service is provided as it is. To the extent the law allows, School Precise is not liable for indirect losses, and our total liability to a school in any
        12 months is limited to the subscription fees the school paid us in that period. Nothing in these terms limits liability that cannot be limited by law.
      </P>

      <H2>9. Ending the service</H2>
      <P>
        A school can stop using School Precise at any time and ask for a copy of its records. We may suspend or close an account that breaks these terms, after giving notice
        where we reasonably can.
      </P>

      <H2>10. Law and changes</H2>
      <P>
        These terms are governed by the laws of the Federal Republic of Nigeria, and the courts of Lagos State have jurisdiction. We may update these terms; we will change
        the date at the top and tell schools about important changes.
      </P>

      <H2>11. Contact</H2>
      <P>School Precise, Lagos, Nigeria. Email: <Mail /></P>
    </>
  )
}

export default function LegalPage({ doc }: { doc: 'privacy' | 'terms' }) {
  const title = doc === 'privacy' ? 'Privacy Policy' : 'Terms of Use'
  useEffect(() => {
    const previous = document.title
    document.title = `${title} · School Precise`
    window.scrollTo(0, 0)
    return () => { document.title = previous }
  }, [title])

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: C.cream, '& .MuiTypography-root': { fontFamily: brand.font } }}>
      <Box component="header" sx={{ borderBottom: `1px solid ${C.line}`, bgcolor: '#fff' }}>
        <Container maxWidth="md" sx={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box component={Link} to="/" aria-label="School Precise home" sx={{ display: 'flex', alignItems: 'center', gap: 1, textDecoration: 'none' }}>
            <BrandMark size={30} />
            <Wordmark fontSize={17} />
          </Box>
          <Stack direction="row" spacing={2.5}>
            <Box component={Link} to={doc === 'privacy' ? '/terms' : '/privacy'} sx={{ color: C.green, fontWeight: 600, fontSize: '14px', textDecoration: 'none' }}>
              {doc === 'privacy' ? 'Terms of Use' : 'Privacy Policy'}
            </Box>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth="md" component="main" sx={{ py: { xs: 5, md: 7 } }}>
        <Box sx={{ maxWidth: 760 }}>
          <Typography component="h1" sx={{ fontWeight: 800, color: C.ink, fontSize: { xs: '2rem', md: '2.6rem' }, letterSpacing: '-1px' }}>{title}</Typography>
          <Typography sx={{ color: C.muted, mt: 1, mb: 4 }}>Last updated {UPDATED}</Typography>
          {doc === 'privacy' ? <Privacy /> : <Terms />}
        </Box>
      </Container>

      <Box component="footer" sx={{ borderTop: `1px solid ${C.line}`, py: 3 }}>
        <Container maxWidth="md">
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 1, sm: 3 }}>
            <Typography sx={{ color: C.muted, fontSize: '0.9rem' }}>© {new Date().getFullYear()} School Precise</Typography>
            <Box component={Link} to="/privacy" sx={{ color: C.muted, fontSize: '0.9rem' }}>Privacy Policy</Box>
            <Box component={Link} to="/terms" sx={{ color: C.muted, fontSize: '0.9rem' }}>Terms of Use</Box>
            <Box component="a" href={`mailto:${EMAIL}`} sx={{ color: C.muted, fontSize: '0.9rem' }}>{EMAIL}</Box>
          </Stack>
        </Container>
      </Box>
    </Box>
  )
}
