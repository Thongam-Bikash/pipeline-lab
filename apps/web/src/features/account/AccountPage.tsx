import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button/Button'
import { Dialog } from '@/components/ui/Dialog/Dialog'
import { Input } from '@/components/ui/Input/Input'
import { authClient, explain } from './client'

const link = 'text-signal underline underline-offset-4'

export function AccountPage() {
  const { data: session, isPending } = authClient.useSession()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [hasPassword, setHasPassword] = useState<boolean>()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  if (isPending) return null

  if (!session) {
    return (
      <div className="max-w-[68ch]">
        <h1 className="text-3xl font-bold">Account</h1>
        {params.get('deleted') ? (
          <p role="status" className="mt-4">
            Your account has been deleted.
          </p>
        ) : (
          <p className="mt-4">
            <Link to="/sign-in" className={link}>
              Sign in
            </Link>{' '}
            to see your account.
          </p>
        )}
      </div>
    )
  }

  const signOut = async () => {
    await authClient.signOut()
    navigate('/')
  }

  const startDelete = async () => {
    setError('')
    setHasPassword(undefined)
    setConfirming(true)
    const { data } = await authClient.listAccounts()
    // If the accounts cannot be read, ask for the password anyway rather than skip the check.
    setHasPassword(data ? data.some((account) => account.providerId === 'credential') : true)
  }

  const deleteAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const password = String(new FormData(event.currentTarget).get('password') ?? '')
    setPending(true)
    // With a password it is checked again; a Google-only account relies on a recent sign-in instead.
    const result = await authClient.deleteUser(hasPassword ? { password } : {})
    setPending(false)
    if (result.error) return setError(explain(result.error))
    setConfirming(false)
    navigate('/account?deleted=1')
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

      <section className="mt-10 border-t border-rule pt-6">
        <h2 className="text-lg font-semibold">Your data</h2>
        <p className="mt-2 text-sm">
          {/* A plain link: the API sends the file as a download, so the browser does the rest. */}
          <a href="/api/account/export" className={link}>
            Download your data
          </a>{' '}
          as a file, with everything this account stores.
        </p>
        <p className="mt-2 text-sm">
          <Link to="/privacy" className={link}>
            How your data is handled
          </Link>
        </p>
      </section>

      <section className="mt-10 border-t border-rule pt-6">
        <h2 className="text-lg font-semibold">Delete account</h2>
        <p className="mt-2 text-sm">This deletes the account straight away, with its progress and saved projects.</p>
        <div className="mt-4">
          <Button onClick={() => void startDelete()}>Delete account</Button>
        </div>
      </section>

      <Dialog open={confirming} title="Delete your account?" onClose={() => setConfirming(false)}>
        <form onSubmit={deleteAccount} className="max-w-[44ch] space-y-4 text-sm">
          <p>Your account, progress and saved projects are deleted at once, and this browser is cleared. This cannot be undone.</p>
          <p className="text-muted">Backups taken before now still contain them until they expire, within 30 days.</p>
          {hasPassword === undefined ? <p className="text-muted">Checking how you sign in…</p> : null}
          {hasPassword ? <Input label="Your password" name="password" type="password" autoComplete="current-password" required /> : null}
          {error ? (
            <p role="alert" className="text-stop">
              {error}
            </p>
          ) : null}
          <div className="flex gap-3">
            <Button variant="primary" type="submit" disabled={pending || hasPassword === undefined}>
              {pending ? 'Deleting…' : 'Delete account'}
            </Button>
            <Button type="button" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
