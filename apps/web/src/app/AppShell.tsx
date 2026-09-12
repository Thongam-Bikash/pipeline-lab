import { NavLink, Outlet } from 'react-router'
import { useSettings, type Theme } from './settings'

const THEMES: Theme[] = ['auto', 'light', 'dark']
const label = (theme: Theme) => theme[0]!.toUpperCase() + theme.slice(1)

const linkStyle = ({ isActive }: { isActive: boolean }) =>
  `rounded-base px-1 py-0.5 ${isActive ? 'text-ink underline underline-offset-4' : 'text-muted hover:text-ink'}`

export function AppShell() {
  const theme = useSettings((state) => state.theme)
  const setTheme = useSettings((state) => state.setTheme)

  return (
    <>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:m-2 focus:rounded-base focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>

      <header className="border-b border-rule">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <NavLink to="/" className="font-semibold">
            Pipeline Lab
          </NavLink>
          <nav className="flex gap-4 text-sm">
            <NavLink to="/playground" className={linkStyle}>
              Playground
            </NavLink>
            <NavLink to="/progress" className={linkStyle}>
              Progress
            </NavLink>
          </nav>
          <label className="ml-auto flex items-center gap-2 text-sm text-muted">
            Theme
            <select
              value={theme}
              onChange={(event) => setTheme(event.target.value as Theme)}
              className="rounded-base border border-rule bg-surface px-2 py-1 text-ink"
            >
              {THEMES.map((option) => (
                <option key={option} value={option}>
                  {label(option)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-5xl px-4 py-10">
        <Outlet />
      </main>
    </>
  )
}
