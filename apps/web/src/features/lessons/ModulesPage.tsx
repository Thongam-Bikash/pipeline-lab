import { Link } from 'react-router'
import { modules } from '@/content/modules'
import { useProgress } from '@/features/progress/store'

export function ModulesPage() {
  const lessons = useProgress((state) => state.lessons)

  return (
    <div className="max-w-[68ch]">
      <h1 className="text-3xl font-bold">Modules</h1>
      <p className="mt-2 text-muted">Each module explains one idea at a time, then asks you to use it.</p>

      <ol className="mt-8 divide-y divide-rule border-y border-rule">
        {modules.map((module) => {
          const done = module.lessons.filter((lesson) => lessons[lesson.id]).length
          return (
            <li key={module.slug} className="py-4">
              <Link to={`/modules/${module.slug}`} className="font-semibold text-signal underline underline-offset-4">
                {module.order}. {module.title}
              </Link>
              <p className="mt-1 text-sm text-muted">{module.summary}</p>
              <p className="mt-1 text-xs text-muted">
                {done} of {module.lessons.length} {module.lessons.length === 1 ? 'lesson' : 'lessons'} finished
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
