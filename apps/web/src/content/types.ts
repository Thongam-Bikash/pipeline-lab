import type { MDXContent } from 'mdx/types'

export type MdxModule = { default: MDXContent }

export type QuizQuestion = {
  prompt: string
  choices: string[]
  answer: number
  explain: string
}

export type Quiz = { questions: QuizQuestion[] }

export type LessonDefinition = {
  slug: string
  title: string
  minutes: number
  // The day the facts in this lesson were last checked against docs.github.com.
  lastVerified: string
  sources: string[]
  load: () => Promise<MdxModule>
}

export type ModuleDefinition = {
  slug: string
  order: number
  title: string
  summary: string
  lessons: LessonDefinition[]
  // Keyed by lesson slug, so every lesson ends with its own questions.
  quizzes: Record<string, Quiz>
  loadRecap: () => Promise<MdxModule>
}

export type Lesson = LessonDefinition & { moduleSlug: string; id: string; quiz: Quiz }
export type Module = Omit<ModuleDefinition, 'lessons'> & { lessons: Lesson[] }
