import type { MDXContent } from 'mdx/types'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { findModule } from '@/content/modules'
import { useProgress } from '@/features/progress/store'
import { mdxComponents } from './mdxComponents'

export function ModulePage() {
  const { moduleSlug = '' } = useParams()
  const module = findModule(moduleSlug)
  const lessons = useProgress((state) => state.lessons)
  const [Recap, setRecap] = useState<MDXContent | null>(null)

  useEffect(() => {
    let cancelled = false
    if (module) void module.loadRecap().then((loaded) => !cancelled && setRecap(() => loaded.default))
    return () => {
      cancelled = true
    }
  }, [module])

  if (!module) {
    return (
      <div className="max-w-[68ch]">
        <h1 className="text-3xl font-bold">Module not found</h1>
        <p className="mt-4">
          <Link to="/modules" className="text-signal underline underline-offset-4">
            Back to the modules
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-[68ch]">
      <p className="text-sm text-muted">Module {module.order}</p>
      <h1 className="mt-1 text-3xl font-bold">{module.title}</h1>
      <p className="mt-2 text-muted">{module.summary}</p>

      <ol className="mt-8 divide-y divide-rule border-y border-rule">
        {module.lessons.map((lesson, index) => (
          <li key={lesson.slug} className="flex items-baseline gap-3 py-3">
            <span className="text-sm text-muted">{index + 1}</span>
            <Link to={`/modules/${module.slug}/${lesson.slug}`} className="text-signal underline underline-offset-4">
              {lesson.title}
            </Link>
            <span className="ml-auto text-xs text-muted">{lessons[lesson.id] ? 'Finished' : `${lesson.minutes} min`}</span>
          </li>
        ))}
      </ol>

      {Recap ? (
        <section className="mt-10">
          <h2 className="text-xl font-semibold">Module recap</h2>
          <Recap components={mdxComponents} />
        </section>
      ) : null}
    </div>
  )
}
