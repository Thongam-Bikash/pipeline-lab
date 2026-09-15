import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button } from '@/components/ui/Button/Button'
import { authClient, explain } from './client'
import { GoogleButton } from './GoogleButton'
import { Input } from '@/components/ui/Input/Input'

export function SignInPage() {
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    const result = await authClient.signIn.email({ email: String(form.get('email')), password: String(form.get('password')) })
    setPending(false)
    if (result.error) return setError(explain(result.error))
    navigate('/account')
  }

  return (
    <div className="max-w-[40ch]">
      <h1 className="text-3xl font-bold">Sign in</h1>
      <p className="mt-2 text-sm text-muted">Signing in keeps your progress in step across your devices.</p>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        <Input label="Password" name="password" type="password" autoComplete="current-password" required />
        {error ? (
          <p role="alert" className="text-sm text-stop">
            {error}
          </p>
        ) : null}
        <Button variant="primary" type="submit" disabled={pending}>
          {pending ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>

      <p className="mt-6 text-sm">
        <Link to="/forgot-password" className="text-signal underline underline-offset-4">
          Forgot your password?
        </Link>
      </p>
      <p className="mt-2 text-sm">
        New here?{' '}
        <Link to="/sign-up" className="text-signal underline underline-offset-4">
          Create an account
        </Link>
      </p>

      <GoogleButton />
    </div>
  )
}
