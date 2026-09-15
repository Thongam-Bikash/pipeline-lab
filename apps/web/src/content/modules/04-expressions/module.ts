import type { ModuleDefinition } from '@/content/types'
import quizzes from './quiz.json'

const CONTEXTS = 'https://docs.github.com/en/actions/reference/workflows-and-actions/contexts'
const EXPRESSIONS = 'https://docs.github.com/en/actions/reference/workflows-and-actions/expressions'

export const module: ModuleDefinition = {
  slug: 'expressions',
  order: 4,
  title: 'Expressions, variables, and data',
  summary: 'Reading the run with contexts, deciding with if, and passing data between steps and jobs.',
  lessons: [
    {
      slug: 'contexts',
      title: 'Contexts and expressions',
      minutes: 9,
      lastVerified: '2026-09-15',
      sources: [CONTEXTS, EXPRESSIONS],
      load: () => import('./lesson-1-contexts.mdx'),
    },
    {
      slug: 'conditions',
      title: 'Conditions and status functions',
      minutes: 9,
      lastVerified: '2026-09-15',
      sources: [`${EXPRESSIONS}#status-check-functions`, CONTEXTS],
      load: () => import('./lesson-2-conditions.mdx'),
    },
    {
      slug: 'env-vars-secrets',
      title: 'env, vars, and secrets',
      minutes: 8,
      lastVerified: '2026-09-15',
      sources: [
        'https://docs.github.com/en/actions/concepts/workflows-and-actions/variables',
        'https://docs.github.com/en/actions/concepts/security/secrets',
      ],
      load: () => import('./lesson-3-env-vars-secrets.mdx'),
    },
    {
      slug: 'outputs-and-artifacts',
      title: 'Outputs and artifacts',
      minutes: 10,
      lastVerified: '2026-09-15',
      sources: [
        'https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands',
        'https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts',
      ],
      load: () => import('./lesson-4-outputs-and-artifacts.mdx'),
    },
  ],
  quizzes,
  loadRecap: () => import('./recap.mdx'),
}
