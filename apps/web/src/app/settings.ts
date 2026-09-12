import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type Theme = 'auto' | 'light' | 'dark'

type Settings = {
  theme: Theme
  setTheme: (theme: Theme) => void
}

// "auto" leaves the attribute off, so the CSS follows the system setting.
function applyTheme(theme: Theme): void {
  const root = document.documentElement
  if (theme === 'auto') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export const useSettings = create<Settings>()(
  persist(
    (set) => ({
      theme: 'auto',
      setTheme: (theme) => {
        applyTheme(theme)
        set({ theme })
      },
    }),
    {
      name: 'pipeline-lab-settings',
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme)
      },
    },
  ),
)
