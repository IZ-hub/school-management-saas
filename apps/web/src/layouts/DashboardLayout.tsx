import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Avatar,
  Divider,
  Button,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  School as SchoolIcon,
  Class as ClassIcon,
  MenuBook as SubjectsIcon,
  EventNote as AttendanceIcon,
  Assignment as ExamsIcon,
  Assessment as ResultsIcon,
  Payment as FeesIcon,
  Receipt as PaymentsIcon,
  Menu as MenuIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material'
import { useAuthStore } from '../store/authStore'

const DRAWER_WIDTH = 240

const navItems = [
  { label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon /> },
  { label: 'Students', path: '/students', icon: <PeopleIcon /> },
  { label: 'Teachers', path: '/teachers', icon: <SchoolIcon /> },
  { label: 'Classes', path: '/classes', icon: <ClassIcon /> },
  { label: 'Subjects', path: '/subjects', icon: <SubjectsIcon /> },
  { label: 'Attendance', path: '/attendance', icon: <AttendanceIcon /> },
  { label: 'Exams', path: '/exams', icon: <ExamsIcon /> },
  { label: 'Results', path: '/results', icon: <ResultsIcon /> },
  { label: 'Fees', path: '/fees', icon: <FeesIcon /> },
  { label: 'Payments', path: '/payments', icon: <PaymentsIcon /> },
]

export default function DashboardLayout() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Avatar sx={{ bgcolor: '#8bc34a', width: 36, height: 36 }}>
          <SchoolIcon fontSize="small" />
        </Avatar>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} noWrap>
            Schoolful LMS
          </Typography>
          <Typography variant="caption" sx={{ color: '#8bc34a', fontSize: '0.65rem', display: 'block' }}>
            Everything School
          </Typography>
        </Box>
      </Box>
      <Divider />
      <List sx={{ flex: 1, px: 1, py: 0.5 }}>
        {navItems.map((item) => (
          <ListItemButton
            key={item.path}
            selected={location.pathname === item.path}
            onClick={() => {
              navigate(item.path)
              if (isMobile) setMobileOpen(false)
            }}
            sx={{
              borderRadius: 1.5,
              mb: 0.25,
              '&.Mui-selected': {
                bgcolor: '#8bc34a',
                color: '#fff',
                '& .MuiListItemIcon-root': { color: '#fff' },
                '&:hover': { bgcolor: '#7cb342' },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
            <ListItemText
              primary={item.label}
              primaryTypographyProps={{ fontSize: '0.875rem' }}
            />
          </ListItemButton>
        ))}
      </List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" noWrap sx={{ mb: 0.5 }}>
          {user?.firstName} {user?.lastName}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mb: 1 }}>
          {user?.role?.replace('_', ' ')}
        </Typography>
        <Button
          fullWidth
          size="small"
          variant="outlined"
          startIcon={<LogoutIcon />}
          onClick={handleLogout}
        >
          Logout
        </Button>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      {isMobile && (
        <AppBar
          position="fixed"
          elevation={1}
          sx={{ zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: '#fff', color: '#111' }}
        >
          <Toolbar sx={{ minHeight: { xs: 56 } }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={() => setMobileOpen(!mobileOpen)}
              sx={{ mr: 1.5 }}
            >
              <MenuIcon />
            </IconButton>
            <Avatar sx={{ bgcolor: '#8bc34a', width: 28, height: 28, mr: 1 }}>
              <SchoolIcon sx={{ fontSize: 16 }} />
            </Avatar>
            <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700 }}>
              Schoolful LMS
            </Typography>
          </Toolbar>
        </AppBar>
      )}

      {/* Mobile drawer */}
      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: isMobile ? 'auto' : DRAWER_WIDTH,
          flexShrink: 0,
          zIndex: (theme) => (isMobile ? theme.zIndex.drawer + 2 : theme.zIndex.drawer),
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            maxWidth: '85vw',
            boxSizing: 'border-box',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0,
          bgcolor: 'background.default',
          mt: isMobile ? '56px' : 0,
          overflow: 'auto',
          width: isMobile ? '100%' : `calc(100% - ${DRAWER_WIDTH}px)`,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
