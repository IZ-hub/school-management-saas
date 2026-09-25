import { useEffect, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'

const navigation = [
  { to: '/', label: 'Dashboard', icon: 'M3 10.5 12 4l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z' },
  { to: '/students', label: 'Students', icon: 'M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4m0 2c-4 0-7 2-7 4.5V21h14v-2.5C19 16 16 14 12 14' },
  { to: '/teachers', label: 'Teachers', icon: 'M4 6h16v10H4zM2 18h20v2H2z' },
  { to: '/classes', label: 'Classes', icon: 'M4 5h16v4H4zm0 6h16v4H4zm0 6h10v2H4z' },
  { to: '/attendance', label: 'Attendance', icon: 'M7 3v2H4v16h16V5h-3V3h-2v2H9V3zm1.5 8.5 2 2 4-4 1.5 1.5-5.5 5.5-3.5-3.5z' },
  { to: '/fees', label: 'Fees', icon: 'M12 3a9 9 0 1 0 9 9 9 9 0 0 0-9-9m1 13.9V18h-2v-1.06a3.6 3.6 0 0 1-2.8-2.44l1.8-.74A1.85 1.85 0 0 0 12 15c.9 0 1.6-.4 1.6-1.1 0-.6-.5-1-1.9-1.4-1.7-.5-3.1-1.1-3.1-2.9A2.9 2.9 0 0 1 11 6.9V6h2v.92a3.2 3.2 0 0 1 2.5 2.2l-1.75.75A1.55 1.55 0 0 0 12.2 8.8c-.9 0-1.5.45-1.5 1 0 .65.65.95 2 1.35 1.9.55 3 1.25 3 3a3 3 0 0 1-2.7 2.75' },
]

function NavIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 fill-current">
      <path d={path} />
    </svg>
  )
}

function NavItems({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-col gap-1 px-3">
      {navigation.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-colors lg:py-2 ${
              isActive ? 'bg-sky-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`
          }
        >
          <NavIcon path={item.icon} />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2 px-5 py-5 text-white">
      <span className="grid h-9 w-9 place-items-center rounded-lg bg-sky-600 text-sm font-bold">SM</span>
      <span className="text-base font-semibold tracking-tight">Scholaris</span>
    </div>
  )
}

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="hidden w-64 shrink-0 bg-slate-900 lg:sticky lg:top-0 lg:block lg:h-dvh lg:overflow-y-auto">
        <Brand />
        <NavItems />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-slate-900/60"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="relative flex h-full w-72 max-w-[85%] flex-col bg-slate-900 shadow-xl">
            <Brand />
            <NavItems onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-700 lg:hidden"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
              <path d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
            </svg>
          </button>

          <label className="relative hidden min-w-0 flex-1 sm:block">
            <span className="sr-only">Search</span>
            <input
              type="search"
              placeholder="Search students, classes, invoices…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-sky-500 focus:bg-white"
            />
          </label>

          <span className="truncate text-sm font-semibold sm:hidden">Scholaris</span>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              aria-label="Notifications"
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-current">
                <path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2m6-6V11a6 6 0 0 0-5-5.91V4a1 1 0 0 0-2 0v1.09A6 6 0 0 0 6 11v5l-2 2v1h16v-1z" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-sky-100 text-sm font-semibold text-sky-700">IZ</span>
              <span className="hidden text-sm leading-tight md:block">
                <span className="block font-medium">Izu Godwin</span>
                <span className="block text-xs text-slate-500">Administrator</span>
              </span>
            </div>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 sm:py-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
