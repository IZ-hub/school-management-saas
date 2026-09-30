import { useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { clearReturnTo, peekReturnTo, rememberReturnTo } from './lib/api'
import LandingPage from './pages/LandingPage'
import Login from './pages/Login'
import RegisterSchool from './pages/RegisterSchool'
import Dashboard from './pages/Dashboard'
import Students from './pages/Students'
import Teachers from './pages/Teachers'
import Classes from './pages/Classes'
import Subjects from './pages/Subjects'
import Attendance from './pages/Attendance'
import Exams from './pages/Exams'
import Results from './pages/Results'
import Fees from './pages/Fees'
import Payments from './pages/Payments'
import DashboardLayout from './layouts/DashboardLayout'
import SupportWidget from './components/SupportWidget'
import { useAuthStore } from './store/authStore'

/** Sends signed-out visitors to /login, remembering the page they wanted. */
function RedirectToLogin() {
  rememberReturnTo()
  return <Navigate to="/login" replace />
}

/** After signing in: back to the page the visitor was sent away from, else the dashboard. */
function AfterSignIn() {
  const target = peekReturnTo() ?? '/dashboard'
  useEffect(() => clearReturnTo(), [])
  return <Navigate to={target} replace />
}

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LandingPage />} />
        <Route path="/login" element={isAuthenticated ? <AfterSignIn /> : <Login />} />
        <Route path="/register" element={isAuthenticated ? <AfterSignIn /> : <RegisterSchool />} />

        {/* Protected routes with sidebar layout */}
        <Route element={isAuthenticated ? <DashboardLayout /> : <RedirectToLogin />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/students" element={<Students />} />
          <Route path="/teachers" element={<Teachers />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/subjects" element={<Subjects />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/results" element={<Results />} />
          <Route path="/fees" element={<Fees />} />
          <Route path="/payments" element={<Payments />} />
        </Route>
      </Routes>
      <SupportWidget />
    </Router>
  )
}

export default App
