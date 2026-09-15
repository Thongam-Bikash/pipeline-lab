import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button/Button'
import { authClient } from './client'

// The API says whether Google is configured, so turning it on needs no rebuild of this app.
export function GoogleButton() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    fetch('/api/config')
      .then((response) => response.json())
      .then((config: { google: boolean }) => setEnabled(config.google))
      .catch(() => setEnabled(false))
  }, [])

  if (!enabled) return null

  return (
    <div className="mt-8 border-t border-rule pt-6">
      <Button type="button" onClick={() => void authClient.signIn.social({ provider: 'google', callbackURL: '/account' })}>
        Continue with Google
      </Button>
    </div>
  )
}
