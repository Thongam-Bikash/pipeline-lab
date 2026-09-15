import type { ModuleDefinition } from '@/content/types'
import quizzes from './quiz.json'

export const module: ModuleDefinition = {
  slug: 'what-is-cicd',
  order: 1,
  title: 'What CI/CD and GitHub Actions are',
  summary: 'Why teams automate builds and tests, what the words mean, and what running them costs.',
  lessons: [
    {
      slug: 'why-teams-automate',
      title: 'Why teams automate',
      minutes: 7,
      lastVerified: '2026-09-15',
      sources: ['https://docs.github.com/en/actions/get-started/continuous-integration'],
      load: () => import('./lesson-1-why-teams-automate.mdx'),
    },
    {
      slug: 'integration-delivery-deployment',
      title: 'Integration, delivery, and deployment',
      minutes: 7,
      lastVerified: '2026-09-15',
      sources: ['https://docs.github.com/en/actions/get-started/continuous-integration'],
      load: () => import('./lesson-2-integration-delivery-deployment.mdx'),
    },
    {
      slug: 'what-it-costs',
      title: 'What it costs',
      minutes: 6,
      lastVerified: '2026-09-15',
      sources: ['https://docs.github.com/en/billing/concepts/product-billing/github-actions'],
      load: () => import('./lesson-3-what-it-costs.mdx'),
    },
  ],
  quizzes,
  loadRecap: () => import('./recap.mdx'),
}
