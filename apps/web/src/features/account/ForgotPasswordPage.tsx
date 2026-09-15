import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button/Button'
import { authClient } from './client'
import { Input } from './Input'

export function ForgotPasswordPage() {
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    const result = await authClient.requestPasswordReset({ email: String(form.get('email')), redirectTo: '/reset-password' })
    setPending(false)
    // The same answer whether or not the address has an account, so this form cannot be used to find out.
    setMessage(
      result.error?.status === 429
        ? 'Too many attempts. Wait a minute, then try again.'
        : 'If an account uses that address, we sent it a link to choose a new password.',
    )
  }

  return (
    <div className="max-w-[40ch]">
      <h1 className="text-3xl font-bold">Reset your password</h1>

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <Input label="Email" name="email" type="email" autoComplete="email" required />
        {message ? (
          <p role="status" className="text-sm">
            {message}
          </p>
        ) : null}
        <Button variant="primary" type="submit" disabled={pending}>
          {pending ? 'Sending…' : 'Send reset link'}
        </Button>
      </form>
    </div>
  )
}
