import { useState } from 'react'
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  InputAdornment,
  IconButton,
  Avatar,
  Stack,
  Fade,
  Link as MuiLink,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  LinearProgress,
} from '@mui/material'
import {
  School as SchoolIcon,
  Email as EmailIcon,
  Lock as LockIcon,
  Person as PersonIcon,
  Phone as PhoneIcon,
  LocationOn as LocationOnIcon,
  Visibility,
  VisibilityOff,
  CheckCircle,
  Public as PublicIcon,
} from '@mui/icons-material'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { api } from '../lib/api'

const countries = [
  { code: 'NG', name: 'Nigeria', phone: '+234' },
  { code: 'GH', name: 'Ghana', phone: '+233' },
  { code: 'KE', name: 'Kenya', phone: '+254' },
  { code: 'ZA', name: 'South Africa', phone: '+27' },
  { code: 'US', name: 'United States', phone: '+1' },
  { code: 'GB', name: 'United Kingdom', phone: '+44' },
]

const nigeriaStates = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT', 'Gombe', 'Imo',
  'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa',
  'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
]

const institutionTypes = ['Primary School', 'Secondary School', 'Nursery / Montessori', 'Combined', 'Tertiary Institution']

export default function RegisterSchool() {
  const [step, setStep] = useState(1)
  const [schoolName, setSchoolName] = useState('')
  const [schoolEmail, setSchoolEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [country, setCountry] = useState('Nigeria')
  const [state, setState] = useState('')
  const [city, setCity] = useState('')
  const [institutionTypesSelected, setInstitutionTypesSelected] = useState<string[]>([])
  const [ownerFirstName, setOwnerFirstName] = useState('')
  const [ownerLastName, setOwnerLastName] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [ownerPassword, setOwnerPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const navigate = useNavigate()
  const setUser = useAuthStore((state) => state.setUser)
  const setAccessToken = useAuthStore((state) => state.setAccessToken)

  const selectedCountry = countries.find((c) => c.name === country)
  const statesList = country === 'Nigeria' ? nigeriaStates : []

  const toggleInstitutionType = (type: string) => {
    setInstitutionTypesSelected((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    )
  }

  const validateStep1 = () => {
    if (!schoolName || institutionTypesSelected.length === 0 || !country || !state || !schoolEmail || !phone) {
      setError('Please complete all school details.')
      return false
    }
    return true
  }

  const validateStep2 = () => {
    if (!ownerFirstName || !ownerLastName || !ownerEmail || !ownerPassword) {
      setError('Please complete all administrator details.')
      return false
    }
    if (ownerPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return false
    }
    if (ownerPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return false
    }
    return true
  }

  const handleNext = () => {
    setError('')
    if (step === 1 && validateStep1()) setStep(2)
  }

  const handleBack = () => {
    setError('')
    setStep(1)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateStep2()) return
    setError('')
    setLoading(true)

    try {
      const response = await api.post('/schools/register', {
        schoolName,
        schoolEmail,
        phone: phone || undefined,
        address: address || undefined,
        country,
        state,
        city: city || undefined,
        institutionTypes: institutionTypesSelected,
        ownerFirstName,
        ownerLastName,
        ownerEmail,
        ownerPassword,
      })
      const { user, accessToken } = response.data.data

      setUser(user)
      setAccessToken(accessToken)
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        bgcolor: '#f5f5f0',
        justifyContent: 'center',
        py: { xs: 3, md: 6 },
        px: { xs: 2, sm: 4 },
      }}
    >
      <Fade in timeout={500}>
        <Paper
          elevation={0}
          sx={{
            width: '100%',
            maxWidth: 680,
            p: { xs: 3, sm: 5 },
            borderRadius: 3,
            border: '1px solid #e0e0e0',
            bgcolor: '#fff',
            height: 'fit-content',
          }}
        >
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            sx={{ mb: 3, flexWrap: 'wrap', gap: 1 }}
          >
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Avatar sx={{ bgcolor: '#1b5e20', width: 40, height: 40 }}>
                <SchoolIcon sx={{ fontSize: 22, color: '#fff' }} />
              </Avatar>
              <Typography variant="h6" fontWeight={700} color="#1b5e20">Schoolful LMS</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary">
              Already have an account?{' '}
              <MuiLink component={Link} to="/login" underline="hover" sx={{ color: '#1b5e20', fontWeight: 600 }}>
                Log in
              </MuiLink>
            </Typography>
          </Stack>

          <Typography variant="h4" component="h1" fontWeight={700} sx={{ mb: 0.75 }}>
            Create your school account
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Step {step} of 2
          </Typography>

          <LinearProgress
            variant="determinate"
            value={step === 1 ? 50 : 100}
            sx={{
              mb: 3,
              height: 6,
              borderRadius: 3,
              bgcolor: '#e0e0e0',
              '& .MuiLinearProgress-bar': { bgcolor: '#1b5e20', borderRadius: 3 },
            }}
          />

          <Fade in={!!error}>
            <Box sx={{ mb: error ? 2 : 0 }}>
              {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}
            </Box>
          </Fade>

          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mx: -3 }}>
            {/* Step chain indicator */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0, mb: 4, mx: 3 }}>
              <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: step >= 1 ? '#8bc34a' : '#e0e0e0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>1</Box>
              <Box sx={{ flex: 1, height: 4, bgcolor: step >= 2 ? '#8bc34a' : '#e0e0e0' }} />
              <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: step >= 2 ? '#8bc34a' : '#e0e0e0', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.85rem' }}>2</Box>
            </Box>

            {step === 1 && (
              <>
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.75rem', letterSpacing: 1, display: 'block', mb: 2, mx: 3 }}>
                  Tell us about your school
                </Typography>

                <Box sx={{ px: 3 }}>
                  <TextField
                    fullWidth
                    label="School name"
                    placeholder="e.g. Famous Schools"
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    margin="normal"
                    required
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fafafa' } }}
                  />

                  <Typography variant="body2" sx={{ mt: 2, mb: 1, color: 'text.secondary' }}>
                    Institution Type <Box component="span" sx={{ color: 'error.main' }}>*</Box>
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                    {institutionTypes.map((t) => (
                      <Box
                        key={t}
                        onClick={() => toggleInstitutionType(t)}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          px: 2,
                          py: 1.25,
                          borderRadius: 2.5,
                          border: '1px solid',
                          borderColor: institutionTypesSelected.includes(t) ? '#8bc34a' : '#e0e0e0',
                          bgcolor: institutionTypesSelected.includes(t) ? '#f1f8e9' : '#fafafa',
                          cursor: 'pointer',
                          '&:hover': { borderColor: '#8bc34a' },
                        }}
                      >
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: '4px',
                            border: '2px solid',
                            borderColor: institutionTypesSelected.includes(t) ? '#8bc34a' : '#bdbdbd',
                            bgcolor: institutionTypesSelected.includes(t) ? '#8bc34a' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {institutionTypesSelected.includes(t) && (
                            <Box component="svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </Box>
                          )}
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 500, color: '#333' }}>{t}</Typography>
                      </Box>
                    ))}
                  </Box>

                  <FormControl fullWidth margin="normal" required sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fafafa' } }}>
                    <InputLabel>Country</InputLabel>
                    <Select
                      value={country}
                      label="Country"
                      onChange={(e) => { setCountry(e.target.value); setState(''); setCity('') }}
                      startAdornment={
                        <InputAdornment position="start">
                          <PublicIcon fontSize="small" color="action" />
                        </InputAdornment>
                      }
                    >
                      {countries.map((c) => (
                        <MenuItem key={c.code} value={c.name}>{c.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth margin="normal" required sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fafafa' } }}>
                    <InputLabel>State</InputLabel>
                    <Select
                      value={state}
                      label="State"
                      onChange={(e) => setState(e.target.value)}
                    >
                      {statesList.map((s) => (
                        <MenuItem key={s} value={s}>{s}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    label="City"
                    placeholder="e.g. Lekki"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    margin="normal"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fafafa' } }}
                  />

                  <TextField
                    fullWidth
                    label="Address"
                    placeholder="e.g. 54 Johnson Jacobs Street, Lekki"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    margin="normal"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fafafa' } }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LocationOnIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    fullWidth
                    label="School phone"
                    placeholder={`e.g. ${selectedCountry?.phone} 706 110 2797`}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    margin="normal"
                    required
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fafafa' } }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    fullWidth
                    label="School email"
                    placeholder="e.g. admin@famousschools.edu.ng"
                    type="email"
                    value={schoolEmail}
                    onChange={(e) => setSchoolEmail(e.target.value)}
                    margin="normal"
                    required
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fafafa' } }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3, px: 3 }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleNext}
                    sx={{
                      borderRadius: 2.5,
                      px: 5,
                      py: 1.25,
                      textTransform: 'none',
                      fontWeight: 600,
                      bgcolor: '#1b5e20',
                      '&:hover': { bgcolor: '#2e7d32' },
                    }}
                  >
                    Continue
                  </Button>
                </Box>
              </>
            )}

            {step === 2 && (
              <>
                <Typography variant="overline" color="text.secondary" sx={{ fontSize: '0.75rem', letterSpacing: 1, display: 'block', mb: 2, mx: 3 }}>
                  Set up the primary administrator account
                </Typography>

                <Box sx={{ px: 3 }}>
                  <TextField
                    fullWidth
                    label="First Name"
                    placeholder="e.g. Adesua"
                    value={ownerFirstName}
                    onChange={(e) => setOwnerFirstName(e.target.value)}
                    margin="normal"
                    required
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fafafa' } }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PersonIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                  <TextField
                    fullWidth
                    label="Last Name"
                    placeholder="e.g. Okafor"
                    value={ownerLastName}
                    onChange={(e) => setOwnerLastName(e.target.value)}
                    margin="normal"
                    required
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fafafa' } }}
                  />

                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    placeholder="e.g. adesua.okafor@gmail.com"
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    margin="normal"
                    required
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fafafa' } }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <EmailIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    fullWidth
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Create a strong password"
                    value={ownerPassword}
                    onChange={(e) => setOwnerPassword(e.target.value)}
                    margin="normal"
                    required
                    helperText="At least 6 characters"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fafafa' } }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle password visibility"
                            onClick={() => setShowPassword((show) => !show)}
                            edge="end"
                            size="small"
                          >
                            {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  <TextField
                    fullWidth
                    label="Confirm Password"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    margin="normal"
                    required
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#fafafa' } }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <LockIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton
                            aria-label="toggle confirm password visibility"
                            onClick={() => setShowConfirm((show) => !show)}
                            edge="end"
                            size="small"
                          >
                            {showConfirm ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                <Stack
                  direction={{ xs: 'column-reverse', sm: 'row' }}
                  spacing={2}
                  justifyContent="space-between"
                  sx={{ mt: 3, px: 3 }}
                >
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={handleBack}
                    sx={{
                      borderRadius: 2.5,
                      px: 4,
                      py: 1.25,
                      textTransform: 'none',
                      fontWeight: 600,
                      color: '#1b5e20',
                      borderColor: '#1b5e20',
                    }}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    disabled={loading}
                    endIcon={<CheckCircle />}
                    sx={{
                      borderRadius: 2.5,
                      px: 4,
                      py: 1.25,
                      textTransform: 'none',
                      fontWeight: 600,
                      bgcolor: '#1b5e20',
                      '&:hover': { bgcolor: '#2e7d32' },
                    }}
                  >
                    {loading ? 'Creating your school...' : 'Create School'}
                  </Button>
                </Stack>
              </>
            )}
          </Box>
        </Paper>
      </Fade>
    </Box>
  )
}
