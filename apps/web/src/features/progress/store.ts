import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type LessonProgress = { completedAt: string; quizScore?: number }
export type ScenarioProgress = { passedAt: string; hintsUsed: number }

type ProgressState = {
  lessons: Record<string, LessonProgress>
  scenarios: Record<string, ScenarioProgress>
  completeLesson: (id: string, quizScore?: number) => void
  passScenario: (id: string, hintsUsed: number) => void
  reset: () => void
}

// Shaped like the rows the API will store in Phase 2, so syncing is a push and a pull.
export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      lessons: {},
      scenarios: {},
      completeLesson: (id, quizScore) =>
        set((state) => ({ lessons: { ...state.lessons, [id]: { completedAt: new Date().toISOString(), quizScore } } })),
      passScenario: (id, hintsUsed) =>
        set((state) => ({ scenarios: { ...state.scenarios, [id]: { passedAt: new Date().toISOString(), hintsUsed } } })),
      reset: () => set({ lessons: {}, scenarios: {} }),
    }),
    { name: 'pipeline-lab-progress', version: 1 },
  ),
)
