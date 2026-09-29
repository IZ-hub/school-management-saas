import { useState } from 'react'
import { Alert, Box, Button, Grid, IconButton, InputAdornment, LinearProgress, Stack, Typography } from '@mui/material'
import { ArrowBack, VisibilityOutlined as Visibility, VisibilityOffOutlined as VisibilityOff } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'
import { AuthCard, AuthField, AuthShell, authColors, describeError, primaryButtonSx } from '../components/auth/AuthShell'

const countries = ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'United Kingdom', 'United States']

const nigeriaStates = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

const schoolTypes = ['Nursery', 'Primary', 'Secondary', 'Primary & Secondary', 'Nursery to Secondary', 'Tertiary']

const steps = [
  { title: 'School details', hint: 'Tell us about your school.' },
  { title: 'Location', hint: 'Where is your school?' },
  { title: 'Administrator account', hint: "You'll use this to log in and manage your school." },
]

const emailPattern = /^\S+@\S+\.\S+$/

type Form = {
  schoolName: string
  schoolType: string
  phone: string
  schoolEmail: string
  country: string
  state: string
  city: string
  address: string
  ownerFirstName: string
  ownerLastName: string
  ownerEmail: string
  ownerPassword: string
  confirmPassword: string
}
type Errors = Partial<Record<keyof Form, string>>

export default function RegisterSchool() {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Form>({
    schoolName: '', schoolType: '', phone: '', schoolEmail: '',
    country: 'Nigeria', state: '', city: '', address: '',
    ownerFirstName: '', ownerLastName: '', ownerEmail: '', ownerPassword: '', confirmPassword: '',
  })
  const [errors, setErrors] = useState<Errors>({})
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const setAccessToken = useAuthStore((state) => state.setAccessToken)

  const set = (key: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.value
    setForm((f) => ({ ...f, [key]: value, ...(key === 'country' ? { state: '' } : {}) }))
    if (errors[key]) setErrors((errs) => ({ ...errs, [key]: undefined }))
  }

  const validateStep = (s: number): Errors => {
    const e: Errors = {}
    if (s === 0) {
      if (!form.schoolName.trim()) e.schoolName = 'Enter your school name'
      if (!form.schoolType) e.schoolType = 'Choose a school type'
      if (!form.phone.trim()) e.phone = 'Enter a phone number'
      else if (form.phone.replace(/\D/g, '').length < 7) e.phone = 'Enter a valid phone number'
      if (!form.schoolEmail.trim()) e.schoolEmail = 'Enter the school email'
      else if (!emailPattern.test(form.schoolEmail.trim())) e.schoolEmail = 'Enter a valid email address'
    }
    if (s === 1) {
      if (!form.country) e.country = 'Choose a country'
      if (!form.state.trim()) e.state = form.country === 'Nigeria' ? 'Choose a state' : 'Enter a state or region'
      if (!form.city.trim()) e.city = 'Enter a city or town'
    }
    if (s === 2) {
      if (!form.ownerFirstName.trim()) e.ownerFirstName = 'Enter your first name'
      if (!form.ownerLastName.trim()) e.ownerLastName = 'Enter your last name'
      if (!form.ownerEmail.trim()) e.ownerEmail = 'Enter your email'
      else if (!emailPattern.test(form.ownerEmail.trim())) e.ownerEmail = 'Enter a valid email address'
      if (form.ownerPassword.length < 6) e.ownerPassword = 'Use at least 6 characters'
      if (form.confirmPassword !== form.ownerPassword) e.confirmPassword = "Passwords don't match"
    }
    return e
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const stepErrors = validateStep(step)
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length > 0) return

    if (step < steps.length - 1) {
      setStep(step + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }

    setLoading(true)
    try {
      const response = await api.post('/schools/register', {
        schoolName: form.schoolName.trim(),
        schoolType: form.schoolType,
        phone: form.phone.trim(),
        schoolEmail: form.schoolEmail.trim(),
        country: form.country,
        state: form.state.trim(),
        city: form.city.trim(),
        address: form.address.trim() || undefined,
        ownerFirstName: form.ownerFirstName.trim(),
        ownerLastName: form.ownerLastName.trim(),
        ownerEmail: form.ownerEmail.trim(),
        ownerPassword: form.ownerPassword,
      })
      const { user, accessToken } = response.data.data
      setUser(user)
      setAccessToken(accessToken)
      navigate('/dashboard')
    } catch (err: any) {
      setError(describeError(err, 'We couldn’t create your school. Please try again.'))
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setLoading(false)
    }
  }

  const goBack = () => {
    setError('')
    setErrors({})
    setStep(step - 1)
  }

  const passwordAdornment = {
    endAdornment: (
      <InputAdornment position="end">
        <IconButton aria-label={showPassword ? 'Hide passwords' : 'Show passwords'} onClick={() => setShowPassword((s) => !s)} edge="end">
          {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
        </IconButton>
      </InputAdornment>
    ),
  }

  return (
    <AuthShell
      title="Create your school account"
      subtitle={
        <>
          <Box component="span" sx={{ display: 'block', fontSize: '0.95rem', mb: 1.5 }}>Step {step + 1} of {steps.length}</Box>
          <LinearProgress
            variant="determinate"
            value={((step + 1) / steps.length) * 100}
            aria-label={`Step ${step + 1} of ${steps.length}`}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: '#e3e3da',
              '& .MuiLinearProgress-bar': { bgcolor: authColors.brand, borderRadius: 3, transition: 'transform 0.4s ease' },
            }}
          />
        </>
      }
      topLinkPrompt="Already have an account?"
      topLinkLabel="Log in"
      topLinkTo="/login"
    >
      {error && (
        <Alert severity="error" role="alert" sx={{ mb: 2.5, borderRadius: 2.5, border: '1px solid #f1c2bd' }}>
          {error}
        </Alert>
      )}

      <AuthCard>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Typography variant="h2" sx={{ fontWeight: 700, fontSize: '1.15rem', color: '#1a1d17' }}>
            {steps[step].title}
          </Typography>
          <Typography variant="body2" sx={{ color: authColors.muted, mb: 3 }}>
            {steps[step].hint}
          </Typography>

          {step === 0 && (
            <>
              <AuthField id="schoolName" label="School name" required autoFocus value={form.schoolName} onChange={set('schoolName')} error={errors.schoolName} placeholder="e.g. Greenfield Academy" />
              <AuthField id="schoolType" label="School type" required select SelectProps={{ native: true }} value={form.schoolType} onChange={set('schoolType')} error={errors.schoolType}>
                <option value="" disabled>Select school type</option>
                {schoolTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </AuthField>
              <AuthField id="phone" label="School phone" required type="tel" autoComplete="tel" inputMode="tel" value={form.phone} onChange={set('phone')} error={errors.phone} placeholder="e.g. 0703 190 0023" />
              <AuthField id="schoolEmail" label="School email" required type="email" autoComplete="email" inputMode="email" value={form.schoolEmail} onChange={set('schoolEmail')} error={errors.schoolEmail} placeholder="e.g. office@greenfield.ng" />
            </>
          )}

          {step === 1 && (
            <>
              <AuthField id="country" label="Country" required select SelectProps={{ native: true }} autoComplete="country-name" value={form.country} onChange={set('country')} error={errors.country}>
                {countries.map((c) => <option key={c} value={c}>{c}</option>)}
              </AuthField>
              {form.country === 'Nigeria' ? (
                <AuthField id="state" label="State" required select SelectProps={{ native: true }} value={form.state} onChange={set('state')} error={errors.state}>
                  <option value="" disabled>Select state</option>
                  {nigeriaStates.map((s) => <option key={s} value={s}>{s}</option>)}
                </AuthField>
              ) : (
                <AuthField id="state" label="State / region" required autoComplete="address-level1" value={form.state} onChange={set('state')} error={errors.state} />
              )}
              <AuthField id="city" label="City / town" required autoComplete="address-level2" value={form.city} onChange={set('city')} error={errors.city} placeholder="e.g. Lekki" />
              <AuthField id="address" label="Street address" autoComplete="street-address" value={form.address} onChange={set('address')} placeholder="e.g. 12 Admiralty Way" helperText="Optional" />
            </>
          )}

          {step === 2 && (
            <>
              <Grid container columnSpacing={2}>
                <Grid item xs={12} sm={6}>
                  <AuthField id="ownerFirstName" label="First name" required autoFocus autoComplete="given-name" value={form.ownerFirstName} onChange={set('ownerFirstName')} error={errors.ownerFirstName} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <AuthField id="ownerLastName" label="Last name" required autoComplete="family-name" value={form.ownerLastName} onChange={set('ownerLastName')} error={errors.ownerLastName} />
                </Grid>
              </Grid>
              <AuthField id="ownerEmail" label="Your email" required type="email" autoComplete="email" inputMode="email" value={form.ownerEmail} onChange={set('ownerEmail')} error={errors.ownerEmail} helperText="You'll log in with this email." />
              <AuthField id="ownerPassword" label="Password" required type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.ownerPassword} onChange={set('ownerPassword')} error={errors.ownerPassword} helperText="At least 6 characters" InputProps={passwordAdornment} />
              <AuthField id="confirmPassword" label="Confirm password" required type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} />
            </>
          )}

          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
            {step > 0 && (
              <Button
                variant="outlined"
                onClick={goBack}
                startIcon={<ArrowBack />}
                sx={{ textTransform: 'none', fontWeight: 600, borderRadius: 2.5, py: 1.5, px: 3, color: authColors.brand, borderColor: authColors.border, bgcolor: '#fff', '&:hover': { borderColor: authColors.brand, bgcolor: '#fff' } }}
              >
                Back
              </Button>
            )}
            <Button type="submit" variant="contained" disabled={loading} sx={{ ...primaryButtonSx, flex: 1 }}>
              {step < steps.length - 1 ? 'Continue' : loading ? 'Creating your school…' : 'Create school account'}
            </Button>
          </Stack>
        </Box>
      </AuthCard>

      <Typography variant="body2" sx={{ color: authColors.muted, textAlign: 'center', mt: 3 }}>
        Free 30-day pilot. No card required.
      </Typography>
    </AuthShell>
  )
}
