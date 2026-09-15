import type { MDXContent } from 'mdx/types'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { findLesson, findModule } from '@/content/modules'
import { useProgress } from '@/features/progress/store'
import { mdxComponents } from './mdxComponents'
import { Quiz } from './Quiz'

const formatDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })

export function LessonPage() {
  const { moduleSlug = '', lessonSlug = '' } = useParams()
  const module = findModule(moduleSlug)
  const lesson = findLesson(moduleSlug, lessonSlug)
  const completeLesson = useProgress((state) => state.completeLesson)
  const finished = useProgress((state) => (lesson ? state.lessons[lesson.id] : undefined))
  // Tracking which lesson was loaded means no reset is needed when moving between lessons,
  // so state is only ever set from the async callback.
  const [loaded, setLoaded] = useState<{ id: string; Content: MDXContent }>()

  useEffect(() => {
    let cancelled = false
    if (lesson) void lesson.load().then((mdx) => !cancelled && setLoaded({ id: lesson.id, Content: mdx.default }))
    return () => {
      cancelled = true
    }
  }, [lesson])

  if (!module || !lesson) {
    return (
      <div className="max-w-[68ch]">
        <h1 className="text-3xl font-bold">Lesson not found</h1>
        <p className="mt-4">
          <Link to="/modules" className="text-signal underline underline-offset-4">
            Back to the modules
          </Link>
        </p>
      </div>
    )
  }

  const Content = loaded?.id === lesson.id ? loaded.Content : undefined
  const position = module.lessons.findIndex((candidate) => candidate.slug === lesson.slug)
  const previous = module.lessons[position - 1]
  const next = module.lessons[position + 1]

  return (
    <div className="max-w-[68ch]">
      <p className="text-sm text-muted">
        <Link to={`/modules/${module.slug}`} className="underline underline-offset-4">
          {module.title}
        </Link>
      </p>
      <h1 className="mt-1 text-3xl font-bold">{lesson.title}</h1>
      <p className="mt-2 text-sm text-muted">
        Lesson {position + 1} of {module.lessons.length}, about {lesson.minutes} minutes. Last verified {formatDate(lesson.lastVerified)}.
      </p>

      <article>{Content ? <Content components={mdxComponents} /> : <p className="mt-6 text-muted">Loading the lesson…</p>}</article>

      {lesson.quiz.questions.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-xl font-semibold">Check yourself</h2>
          <div className="mt-3">
            <Quiz key={lesson.id} quiz={lesson.quiz} onFinish={(score) => completeLesson(lesson.id, score)} />
          </div>
        </section>
      ) : null}

      {finished ? <p className="mt-6 text-xs text-muted">Finished{finished.quizScore === undefined ? '' : `, quiz ${finished.quizScore}%`}.</p> : null}

      <nav className="mt-12 flex justify-between gap-4 border-t border-rule pt-4 text-sm">
        {previous ? (
          <Link to={`/modules/${module.slug}/${previous.slug}`} className="text-signal underline underline-offset-4">
            Previous: {previous.title}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link to={`/modules/${module.slug}/${next.slug}`} className="text-signal underline underline-offset-4">
            Next: {next.title}
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </div>
  )
}
