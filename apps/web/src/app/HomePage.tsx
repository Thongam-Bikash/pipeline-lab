import { Link } from 'react-router'

export function HomePage() {
  return (
    <div className="max-w-[68ch]">
      <h1 className="text-4xl font-bold">Pipeline Lab</h1>
      <p className="mt-4 text-lg">
        Learn GitHub Actions by running pipelines. Lessons explain one idea at a time, the simulator runs your workflow in the browser, and incident
        scenarios put you on the wrong end of a broken pipeline until you fix it.
      </p>
      <p className="mt-4 text-muted">
        The simulator models a documented subset of GitHub Actions. When a workflow uses something it does not model, it says so rather than pretending.
      </p>
      <p className="mt-8">
        <Link to="/progress" className="text-signal underline underline-offset-4">
          See your progress
        </Link>
      </p>
    </div>
  )
}
