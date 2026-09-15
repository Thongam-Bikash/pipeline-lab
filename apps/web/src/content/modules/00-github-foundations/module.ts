import type { ModuleDefinition } from '@/content/types'
import quizzes from './quiz.json'

export const module: ModuleDefinition = {
  slug: 'github-foundations',
  order: 0,
  title: 'GitHub foundations',
  summary: 'Repositories, pull requests, forks, and the rules that guard a branch. The ground CI stands on.',
  lessons: [
    {
      slug: 'repositories-and-branches',
      title: 'Repositories and branches',
      minutes: 6,
      lastVerified: '2026-09-15',
      sources: ['https://docs.github.com/en/pull-requests/get-started/about-pull-requests'],
      load: () => import('./lesson-1-repositories-and-branches.mdx'),
    },
    {
      slug: 'pull-requests',
      title: 'Pull requests and review',
      minutes: 8,
      lastVerified: '2026-09-15',
      sources: ['https://docs.github.com/en/pull-requests/get-started/about-pull-requests'],
      load: () => import('./lesson-2-pull-requests.mdx'),
    },
    {
      slug: 'forks',
      title: 'Forks and contributing',
      minutes: 6,
      lastVerified: '2026-09-15',
      sources: ['https://docs.github.com/en/pull-requests/get-started/about-forks'],
      load: () => import('./lesson-3-forks.mdx'),
    },
    {
      slug: 'protecting-main',
      title: 'Protecting main',
      minutes: 9,
      lastVerified: '2026-09-15',
      sources: [
        'https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets',
        'https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets',
      ],
      load: () => import('./lesson-4-protecting-main.mdx'),
    },
  ],
  quizzes,
  loadRecap: () => import('./recap.mdx'),
}
