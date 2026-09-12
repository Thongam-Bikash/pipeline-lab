import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <div className="max-w-[68ch]">
      <h1 className="text-3xl font-bold">Page not found</h1>
      <p className="mt-4 text-muted">That address does not match anything in Pipeline Lab.</p>
      <p className="mt-8">
        <Link to="/" className="text-signal underline underline-offset-4">
          Back to the start
        </Link>
      </p>
    </div>
  )
}
