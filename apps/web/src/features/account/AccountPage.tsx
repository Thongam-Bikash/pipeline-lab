import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button/Button'
import { authClient } from './client'

export function AccountPage() {
  const { data: session, isPending } = authClient.useSession()
  const [params] = useSearchParams()
  const navigate = useNavigate()

  if (isPending) return null

  if (!session) {
    return (
      <div className="max-w-[68ch]">
        <h1 className="text-3xl font-bold">Account</h1>
        <p className="mt-4">
          <Link to="/sign-in" className="text-signal underline underline-offset-4">
            Sign in
          </Link>{' '}
          to see your account.
        </p>
      </div>
    )
  }

  const signOut = async () => {
    await authClient.signOut()
    navigate('/')
  }

  return (
    <div className="max-w-[68ch]">
      <h1 className="text-3xl font-bold">Account</h1>

      {/* The verification link lands here, so confirm it worked. */}
      {params.get('verified') ? (
        <p role="status" className="mt-4 text-go">
          ✓ Your email address is confirmed.
        </p>
      ) : null}

      <dl className="mt-6 text-sm">
        <dt className="text-muted">Signed in as</dt>
        <dd className="mt-1 text-ink">{session.user.email}</dd>
      </dl>

      <div className="mt-8">
        <Button onClick={() => void signOut()}>Sign out</Button>
      </div>
    </div>
  )
}
