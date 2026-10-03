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
import ClassSubjects from './pages/ClassSubjects'
import Attendance from './pages/Attendance'
import Exams from './pages/Exams'
import ExamSeriesPage from './pages/ExamSeries'
import Results from './pages/Results'
import ReportCards from './pages/ReportCards'
import Fees from './pages/Fees'
import Payments from './pages/Payments'
import ParentHome from './pages/ParentHome'
import ParentSetup from './pages/ParentSetup'
import Staff from './pages/Staff'
import Promotion from './pages/Promotion'
import Settings from './pages/Settings'
import Messages from './pages/Messages'
import Timetable from './pages/Timetable'
import DashboardLayout from './layouts/DashboardLayout'
import SupportWidget from './components/SupportWidget'
import { useAuthStore } from './store/authStore'

/** Sends signed-out visitors to /login, remembering the page they wanted. */
function RedirectToLogin() {
  rememberReturnTo()
  return <Navigate to="/login" replace />
}

/** After signing in: back to the page the visitor was sent away from, else their home page. */
function AfterSignIn() {
  const isParent = useAuthStore((state) => state.user?.role) === 'PARENT'
  const saved = peekReturnTo()
  // Parents only have their own page, so a remembered staff page is ignored for them.
  const target = isParent ? (saved?.startsWith('/parent') ? saved : '/parent') : saved ?? '/dashboard'
  useEffect(() => clearReturnTo(), [])
  return <Navigate to={target} replace />
}

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const isParent = useAuthStore((state) => state.user?.role) === 'PARENT'
  const home = isParent ? '/parent' : '/dashboard'

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={isAuthenticated ? <Navigate to={home} /> : <LandingPage />} />
        <Route path="/login" element={isAuthenticated ? <AfterSignIn /> : <Login />} />
        <Route path="/register" element={isAuthenticated ? <AfterSignIn /> : <RegisterSchool />} />

        <Route path="/parent-setup" element={<ParentSetup />} />
        <Route path="/setup" element={<ParentSetup />} />

        {/* Parents: their own children only */}
        <Route path="/parent" element={!isAuthenticated ? <RedirectToLogin /> : isParent ? <ParentHome /> : <Navigate to="/dashboard" replace />} />

        {/* Staff routes with sidebar layout */}
        <Route element={!isAuthenticated ? <RedirectToLogin /> : isParent ? <Navigate to="/parent" replace /> : <DashboardLayout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/students" element={<Students />} />
          <Route path="/teachers" element={<Teachers />} />
          <Route path="/classes" element={<Classes />} />
          <Route path="/subjects" element={<Subjects />} />
          <Route path="/class-subjects" element={<ClassSubjects />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/exams" element={<Exams />} />
          <Route path="/exams/:seriesId" element={<ExamSeriesPage />} />
          <Route path="/results" element={<Results />} />
          <Route path="/report-cards" element={<ReportCards />} />
          <Route path="/fees" element={<Fees />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/staff" element={<Staff />} />
          <Route path="/promotion" element={<Promotion />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/messages" element={<Messages />} />
          <Route path="/timetable" element={<Timetable />} />
        </Route>
      </Routes>
      {!isParent && <SupportWidget />}
    </Router>
  )
}

export default App
