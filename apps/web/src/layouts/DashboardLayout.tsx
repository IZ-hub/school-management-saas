import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  Avatar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  SpaceDashboardOutlined as DashboardIcon,
  PeopleOutlined as PeopleIcon,
  SchoolOutlined as SchoolIcon,
  ClassOutlined as ClassIcon,
  MenuBookOutlined as SubjectsIcon,
  LibraryBooksOutlined as ClassSubjectsIcon,
  EventAvailableOutlined as AttendanceIcon,
  AssignmentOutlined as ExamsIcon,
  InsightsOutlined as ResultsIcon,
  ArticleOutlined as ReportCardsIcon,
  RequestQuoteOutlined as FeesIcon,
  ReceiptLongOutlined as PaymentsIcon,
  HelpOutlineOutlined as HelpIcon,
  LogoutOutlined as LogoutIcon,
  Menu as MenuIcon,
  School as LogoIcon,
  ManageAccountsOutlined as StaffIcon,
  UpgradeOutlined as PromotionIcon,
  SettingsOutlined as SettingsIcon,
  ForumOutlined as MessagesIcon,
} from '@mui/icons-material'
import { useAuthStore } from '../store/authStore'
import { signOut } from '../lib/api'
import { brand } from '../theme'
import { ACADEMIC_ROLES, ADMIN_ROLES, FINANCE_ROLES, STAFF_ROLES } from '../lib/roles'

const DRAWER_WIDTH = 248

const navSections: { heading: string | null; items: { label: string; path: string; icon: JSX.Element; roles: string[] }[] }[] = [
  {
    heading: null,
    items: [{ label: 'Dashboard', path: '/dashboard', icon: <DashboardIcon />, roles: STAFF_ROLES }],
  },
  {
    heading: 'People',
    items: [
      { label: 'Students', path: '/students', icon: <PeopleIcon />, roles: STAFF_ROLES },
      { label: 'Teachers', path: '/teachers', icon: <SchoolIcon />, roles: STAFF_ROLES },
      { label: 'Staff accounts', path: '/staff', icon: <StaffIcon />, roles: ADMIN_ROLES },
    ],
  },
  {
    heading: 'Academics',
    items: [
      { label: 'Classes', path: '/classes', icon: <ClassIcon />, roles: STAFF_ROLES },
      { label: 'Subjects', path: '/subjects', icon: <SubjectsIcon />, roles: STAFF_ROLES },
      { label: 'Class subjects', path: '/class-subjects', icon: <ClassSubjectsIcon />, roles: STAFF_ROLES },
      { label: 'Attendance', path: '/attendance', icon: <AttendanceIcon />, roles: ACADEMIC_ROLES },
      { label: 'Exams', path: '/exams', icon: <ExamsIcon />, roles: ACADEMIC_ROLES },
      { label: 'Results', path: '/results', icon: <ResultsIcon />, roles: ACADEMIC_ROLES },
      { label: 'Report cards', path: '/report-cards', icon: <ReportCardsIcon />, roles: ACADEMIC_ROLES },
      { label: 'Promotion', path: '/promotion', icon: <PromotionIcon />, roles: ADMIN_ROLES },
    ],
  },
  {
    heading: 'Finance',
    items: [
      { label: 'Fees', path: '/fees', icon: <FeesIcon />, roles: FINANCE_ROLES },
      { label: 'Payments', path: '/payments', icon: <PaymentsIcon />, roles: FINANCE_ROLES },
    ],
  },
  {
    heading: 'School',
    items: [
      { label: 'Messages', path: '/messages', icon: <MessagesIcon />, roles: [...ADMIN_ROLES, 'ACCOUNTANT'] },
      { label: 'School settings', path: '/settings', icon: <SettingsIcon />, roles: ADMIN_ROLES },
    ],
  },
]

const itemSx = {
  borderRadius: '10px',
  minHeight: 40,
  px: 1.5,
  mb: '2px',
  color: '#3d433d',
  '& .MuiListItemIcon-root': { minWidth: 34, color: brand.subtle, '& svg': { fontSize: 20 } },
  '&:hover': { bgcolor: '#f4f3ee' },
  '&.Mui-selected': {
    bgcolor: brand.greenSoft,
    color: brand.green,
    '& .MuiListItemIcon-root': { color: brand.green },
    '& .MuiListItemText-primary': { fontWeight: 600 },
    '&:hover': { bgcolor: '#e6eee3' },
  },
}

const initials = (first?: string, last?: string) => `${first?.[0] ?? ''}${last?.[0] ?? ''}`.toUpperCase() || '?'
const roleLabel = (role?: string) => (role ? role.charAt(0) + role.slice(1).toLowerCase().replace(/_/g, ' ') : '')

function Logo() {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <Avatar sx={{ bgcolor: '#1b5e20', width: 32, height: 32 }}>
        <LogoIcon sx={{ fontSize: 18, color: '#fff' }} />
      </Avatar>
      <Typography sx={{ fontWeight: 800, fontSize: '17px', color: brand.green, letterSpacing: '-0.2px' }}>Schoolful LMS</Typography>
    </Stack>
  )
}

export default function DashboardLayout() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const role = user?.role ?? ''

  const go = (path: string) => {
    navigate(path)
    if (isMobile) setMobileOpen(false)
  }

  const handleLogout = async () => {
    await signOut()
    navigate('/login')
  }

  const openSupport = () => {
    if (isMobile) setMobileOpen(false)
    window.dispatchEvent(new Event('schoolful:open-support'))
  }

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: brand.surface }}>
      <Box sx={{ px: 2.5, height: 64, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        <Logo />
      </Box>

      <Box component="nav" aria-label="Main" sx={{ flex: 1, overflowY: 'auto', px: 1.5, pb: 2 }}>
        {navSections
          .map((section) => ({ ...section, items: section.items.filter((i) => i.roles.includes(role)) }))
          .filter((section) => section.items.length > 0)
          .map((section) => (
          <Box key={section.heading ?? 'main'} sx={{ mt: section.heading ? 2.5 : 1 }}>
            {section.heading && (
              <Typography sx={{ px: 1.5, mb: 0.75, fontSize: '11px', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: brand.subtle }}>
                {section.heading}
              </Typography>
            )}
            <List disablePadding>
              {section.items.map((item) => (
                <ListItemButton
                  key={item.path}
                  selected={location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)}
                  aria-current={location.pathname === item.path ? 'page' : undefined}
                  onClick={() => go(item.path)}
                  sx={itemSx}
                >
                  <ListItemIcon>{item.icon}</ListItemIcon>
                  <ListItemText primary={item.label} primaryTypographyProps={{ fontSize: '14px', fontWeight: 500 }} />
                </ListItemButton>
              ))}
            </List>
          </Box>
        ))}
      </Box>

      <Box sx={{ px: 1.5, pt: 1, pb: 1.5, borderTop: `1px solid ${brand.border}`, flexShrink: 0 }}>
        <ListItemButton onClick={openSupport} sx={itemSx}>
          <ListItemIcon><HelpIcon /></ListItemIcon>
          <ListItemText primary="Help & support" primaryTypographyProps={{ fontSize: '14px', fontWeight: 500 }} />
        </ListItemButton>
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 1, pt: 1.25 }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: brand.greenSoft, color: brand.green, fontSize: '13px', fontWeight: 700 }}>
            {initials(user?.firstName, user?.lastName)}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography noWrap sx={{ fontSize: '13.5px', fontWeight: 600, color: brand.text, lineHeight: 1.3 }}>
              {user?.firstName} {user?.lastName}
            </Typography>
            <Typography noWrap sx={{ fontSize: '12px', color: brand.subtle, lineHeight: 1.3 }}>
              {roleLabel(user?.role)}
            </Typography>
          </Box>
          <Tooltip title="Sign out">
            <IconButton aria-label="Sign out" onClick={handleLogout} size="small" sx={{ color: brand.subtle, '&:hover': { color: brand.text } }}>
              <LogoutIcon sx={{ fontSize: 19 }} />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>
    </Box>
  )

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        width: '100%',
        bgcolor: brand.page,
        // Same typeface as the sign-in pages throughout the app.
        '& .MuiTypography-root, & .MuiButton-root, & .MuiInputBase-root, & .MuiTableCell-root, & .MuiChip-root, & .MuiTab-root, & .MuiMenuItem-root, & .MuiFormLabel-root':
          { fontFamily: brand.font },
        // Page titles on every screen match the dashboard heading.
        '& main .MuiTypography-h4': { fontWeight: 800, letterSpacing: '-0.6px', color: brand.text, fontSize: { xs: '24px', sm: '28px' } },
      }}
    >
      {isMobile && (
        <Box
          component="header"
          sx={{
            position: 'fixed', top: 0, left: 0, right: 0, height: 56, zIndex: (t) => t.zIndex.drawer + 1,
            bgcolor: 'rgba(255,255,255,0.94)', backdropFilter: 'blur(10px)', borderBottom: `1px solid ${brand.border}`,
            display: 'flex', alignItems: 'center', px: 1, gap: 0.5,
          }}
        >
          <IconButton aria-label="Open menu" onClick={() => setMobileOpen(true)} sx={{ color: brand.text }}>
            <MenuIcon />
          </IconButton>
          <Box sx={{ flex: 1 }}><Logo /></Box>
          <Avatar sx={{ width: 32, height: 32, mr: 1, bgcolor: brand.greenSoft, color: brand.green, fontSize: '12.5px', fontWeight: 700 }}>
            {initials(user?.firstName, user?.lastName)}
          </Avatar>
        </Box>
      )}

      <Drawer
        variant={isMobile ? 'temporary' : 'permanent'}
        open={isMobile ? mobileOpen : true}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH,
            boxSizing: 'border-box',
            borderRight: `1px solid ${brand.border}`,
            fontFamily: brand.font,
            '& .MuiTypography-root, & .MuiListItemText-primary': { fontFamily: brand.font },
          },
        }}
      >
        {drawerContent}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          mt: isMobile ? '56px' : 0,
          minWidth: 0,
          width: isMobile ? '100%' : `calc(100% - ${DRAWER_WIDTH}px)`,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  )
}
