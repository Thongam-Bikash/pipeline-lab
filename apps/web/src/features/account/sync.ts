import { useProgress } from '@/features/progress/store'

let current: string | undefined
let adopting = false

// The server merges, so the whole sync is: send the snapshot, adopt the answer.
async function push() {
  const user = current
  if (!user) return
  const sent = useProgress.getState()
  try {
    const response = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lessons: sent.lessons, scenarios: sent.scenarios, projects: {} }),
    })
    if (!response.ok) return
    const merged = await response.json()
    const now = useProgress.getState()
    // Something changed while this was out: the push queued for that change adopts the newer answer.
    if (current !== user || now.lessons !== sent.lessons || now.scenarios !== sent.scenarios) return
    adopting = true
    useProgress.setState({ lessons: merged.lessons, scenarios: merged.scenarios })
    adopting = false
  } catch {
    // Offline is normal: every push carries the whole snapshot, so the next one catches up.
  }
}

useProgress.subscribe(() => {
  if (!adopting) void push()
})

export function sessionChanged(userId: string | undefined) {
  if (userId === current) return
  const previous = current
  current = undefined
  // A sign-out or a different account must not inherit what is on this browser. A guest is never cleared.
  if (previous) useProgress.getState().reset()
  current = userId
  void push()
}

// Awaited before a reset, or the sync after it would meet the old progress on the server and bring it back.
export async function clearRemote() {
  if (current) await fetch('/api/progress', { method: 'DELETE' }).catch(() => undefined)
}
