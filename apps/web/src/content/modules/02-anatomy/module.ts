import type { ModuleDefinition } from '@/content/types'
import quizzes from './quiz.json'

export const module: ModuleDefinition = {
  slug: 'anatomy',
  order: 2,
  title: 'Anatomy of a workflow',
  summary: 'What a workflow file contains, and how the parts fit together.',
  lessons: [
    {
      slug: 'what-a-workflow-contains',
      title: 'What a workflow file contains',
      minutes: 8,
      lastVerified: '2026-09-15',
      sources: ['https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax'],
      load: () => import('./lesson-1-what-a-workflow-contains.mdx'),
    },
  ],
  quizzes,
  loadRecap: () => import('./recap.mdx'),
}
