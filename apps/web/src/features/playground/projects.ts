import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// The API owns this shape and its limits, in apps/api/src/merge.ts and app.ts.
export type Project = { id: string; name: string; source: string; updatedAt: string }

export const MAX_PROJECTS = 50
export const MAX_SOURCE = 16_000

type ProjectsState = {
  projects: Record<string, Project>
  save: (name: string, source: string, id?: string) => string
  remove: (id: string) => void
  clear: () => void
}

export const useProjects = create<ProjectsState>()(
  persist(
    (set) => ({
      projects: {},
      // A new id comes from the browser, so saving the same project again updates it everywhere.
      save: (name, source, id = crypto.randomUUID()) => {
        set((state) => ({ projects: { ...state.projects, [id]: { id, name, source, updatedAt: new Date().toISOString() } } }))
        return id
      },
      remove: (id) => set((state) => ({ projects: Object.fromEntries(Object.entries(state.projects).filter(([key]) => key !== id)) })),
      clear: () => set({ projects: {} }),
    }),
    { name: 'pipeline-lab-projects', version: 1 },
  ),
)
