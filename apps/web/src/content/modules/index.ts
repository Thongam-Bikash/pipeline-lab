import type { Module, ModuleDefinition } from '@/content/types'

// Every module folder exports one definition. Prose stays behind a lazy import, so listing
// modules never loads a lesson.
const definitions = import.meta.glob('./*/module.ts', { eager: true, import: 'module' }) as Record<string, ModuleDefinition>

export const modules: Module[] = Object.values(definitions)
  .map((definition) => ({
    ...definition,
    lessons: definition.lessons.map((lesson) => ({
      ...lesson,
      moduleSlug: definition.slug,
      id: `${definition.slug}/${lesson.slug}`,
      quiz: definition.quizzes[lesson.slug] ?? { questions: [] },
    })),
  }))
  .sort((a, b) => a.order - b.order)

export const findModule = (slug: string): Module | undefined => modules.find((module) => module.slug === slug)

export const findLesson = (moduleSlug: string, lessonSlug: string) => findModule(moduleSlug)?.lessons.find((lesson) => lesson.slug === lessonSlug)

export const allLessons = modules.flatMap((module) => module.lessons)
