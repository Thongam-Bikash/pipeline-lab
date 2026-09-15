import type { ModuleDefinition } from '@/content/types'
import quizzes from './quiz.json'

export const module: ModuleDefinition = {
  slug: 'anatomy',
  order: 2,
  title: 'Anatomy of a workflow',
  summary: 'What a workflow file contains, the machines and actions it uses, and the YAML traps along the way.',
  lessons: [
    {
      slug: 'what-a-workflow-contains',
      title: 'What a workflow file contains',
      minutes: 8,
      lastVerified: '2026-09-15',
      sources: [
        'https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax',
        'https://docs.github.com/en/actions/concepts/workflows-and-actions/workflows',
      ],
      load: () => import('./lesson-1-what-a-workflow-contains.mdx'),
    },
    {
      slug: 'runners-and-actions',
      title: 'Runners and actions',
      minutes: 8,
      lastVerified: '2026-09-15',
      sources: [
        'https://docs.github.com/en/actions/concepts/runners/github-hosted-runners',
        'https://docs.github.com/en/actions/concepts/workflows-and-actions/custom-actions',
      ],
      load: () => import('./lesson-2-runners-and-actions.mdx'),
    },
    {
      slug: 'where-files-live',
      title: 'Where workflow files live',
      minutes: 6,
      lastVerified: '2026-09-15',
      sources: ['https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax'],
      load: () => import('./lesson-3-where-files-live.mdx'),
    },
    {
      slug: 'yaml-traps',
      title: 'YAML and its classic traps',
      minutes: 9,
      lastVerified: '2026-09-15',
      sources: ['https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#filter-pattern-cheat-sheet'],
      load: () => import('./lesson-4-yaml-traps.mdx'),
    },
  ],
  quizzes,
  loadRecap: () => import('./recap.mdx'),
}
