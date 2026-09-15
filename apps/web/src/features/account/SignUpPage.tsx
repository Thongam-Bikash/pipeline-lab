import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button/Button'
import { authClient, explain } from './client'
import { GoogleButton } from './GoogleButton'
import { Input } from '@/components/ui/Input/Input'

export function SignUpPage() {
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [sentTo, setSentTo] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email'))
    setPending(true)
    // No name field: nothing in the app shows one, so it would be personal data kept for nothing.
    const result = await authClient.signUp.email({ email, password: String(form.get('password')), name: '', callbackURL: '/account?verified=1' })
    setPending(false)
    if (result.error) return setError(explain(result.error))
    setSentTo(email)
  }

  if (sentTo) {
    return (
      <div className="max-w-[40ch]">
        <h1 className="text-3xl font-bold">Check your inbox</h1>
        <p className="mt-4">
          We sent a link to <span className="font-semibold">{sentTo}</span>. Open it to finish creating your account.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-[40ch]">
      <h1 className="text-3xl font-bold">Create an account</h1>
      <p className="mt-2 text-sm text-muted">Everything works without one. An account keeps your progress in step across devices.</p>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        <Input label="Password" name="password" type="password" autoComplete="new-password" minLength={8} hint="At least 8 characters." required />
        {error ? (
          <p role="alert" className="text-sm text-stop">
            {error}
          </p>
        ) : null}
        <Button variant="primary" type="submit" disabled={pending}>
          {pending ? 'Creating your account…' : 'Create account'}
        </Button>
      </form>

      <p className="mt-6 text-sm">
        Already have one?{' '}
        <Link to="/sign-in" className="text-signal underline underline-offset-4">
          Sign in
        </Link>
      </p>

      <GoogleButton />
    </div>
  )
}
