import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Button } from '@/components/ui/Button/Button'
import { authClient, explain } from './client'
import { Input } from './Input'

const link = 'text-signal underline underline-offset-4'

export function ResetPasswordPage() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    const result = await authClient.resetPassword({ newPassword: String(form.get('password')), token: token ?? '' })
    setPending(false)
    if (result.error) return setError(explain(result.error))
    setDone(true)
  }

  // The API redirects here with ?error= when the link has expired or was already used.
  if (!token || params.get('error')) {
    return (
      <div className="max-w-[40ch]">
        <h1 className="text-3xl font-bold">Reset your password</h1>
        <p className="mt-4">
          This link has expired or was already used.{' '}
          <Link to="/forgot-password" className={link}>
            Ask for a new one
          </Link>
          .
        </p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="max-w-[40ch]">
        <h1 className="text-3xl font-bold">Password changed</h1>
        <p className="mt-4">
          <Link to="/sign-in" className={link}>
            Sign in with your new password
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-[40ch]">
      <h1 className="text-3xl font-bold">Choose a new password</h1>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Input label="New password" name="password" type="password" autoComplete="new-password" minLength={8} hint="At least 8 characters." required />
        {error ? (
          <p role="alert" className="text-sm text-stop">
            {error}
          </p>
        ) : null}
        <Button variant="primary" type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save new password'}
        </Button>
      </form>
    </div>
  )
}
