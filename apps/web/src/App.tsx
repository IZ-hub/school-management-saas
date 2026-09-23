import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
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
import { useAuthStore } from './store/authStore'

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <LandingPage />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/dashboard" /> : <RegisterSchool />} />

        {/* Protected routes with sidebar layout */}
        <Route element={isAuthenticated ? <DashboardLayout /> : <Navigate to="/login" />}>
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
    </Router>
  )
}

export default App
