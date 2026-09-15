import type { ModuleDefinition } from '@/content/types'
import quizzes from './quiz.json'

const SYNTAX = 'https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax'
const EVENTS = 'https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows'

export const module: ModuleDefinition = {
  slug: 'triggers',
  order: 3,
  title: 'Triggers and filters',
  summary: 'Choosing exactly when a workflow runs, and why the wrong trigger is a security problem.',
  lessons: [
    {
      slug: 'push-and-pull-request',
      title: 'Push and pull request',
      minutes: 8,
      lastVerified: '2026-09-15',
      sources: [EVENTS, SYNTAX],
      load: () => import('./lesson-1-push-and-pull-request.mdx'),
    },
    {
      slug: 'filters',
      title: 'Branch, tag, and path filters',
      minutes: 10,
      lastVerified: '2026-09-15',
      sources: [`${SYNTAX}#filter-pattern-cheat-sheet`, SYNTAX],
      load: () => import('./lesson-2-filters.mdx'),
    },
    {
      slug: 'manual-and-scheduled',
      title: 'Manual runs and schedules',
      minutes: 9,
      lastVerified: '2026-09-15',
      sources: [EVENTS, SYNTAX],
      load: () => import('./lesson-3-manual-and-scheduled.mdx'),
    },
    {
      slug: 'pull-request-target',
      title: 'pull_request and pull_request_target',
      minutes: 8,
      lastVerified: '2026-09-15',
      sources: [`${EVENTS}#pull_request_target`, 'https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target'],
      load: () => import('./lesson-4-pull-request-target.mdx'),
    },
  ],
  quizzes,
  loadRecap: () => import('./recap.mdx'),
}
