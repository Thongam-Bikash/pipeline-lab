import { useProjects } from '@/features/playground/projects'
import { useProgress } from '@/features/progress/store'

let current: string | undefined
let adopting = false

// The server merges, so the whole sync is: send the snapshot, adopt the answer.
async function push() {
  const user = current
  if (!user) return
  const progress = useProgress.getState()
  const saved = useProjects.getState()
  try {
    const response = await fetch('/api/state', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ lessons: progress.lessons, scenarios: progress.scenarios, projects: saved.projects }),
    })
    if (!response.ok) return
    const merged = await response.json()
    const changed =
      useProgress.getState().lessons !== progress.lessons ||
      useProgress.getState().scenarios !== progress.scenarios ||
      useProjects.getState().projects !== saved.projects
    // Something changed while this was out: the push queued for that change adopts the newer answer.
    if (current !== user || changed) return
    adopting = true
    useProgress.setState({ lessons: merged.lessons, scenarios: merged.scenarios })
    useProjects.setState({ projects: merged.projects })
    adopting = false
  } catch {
    // Offline is normal: every push carries the whole snapshot, so the next one catches up.
  }
}

const pushUnlessAdopting = () => {
  if (!adopting) void push()
}
useProgress.subscribe(pushUnlessAdopting)
useProjects.subscribe(pushUnlessAdopting)

export function sessionChanged(userId: string | undefined) {
  if (userId === current) return
  const previous = current
  current = undefined
  // A sign-out or a different account must not inherit what is on this browser. A guest is never cleared.
  if (previous) {
    useProgress.getState().reset()
    useProjects.getState().clear()
  }
  current = userId
  void push()
}

// Awaited before the local change, or the sync after it would meet the old data on the server and bring it back.
export async function clearRemote() {
  if (current) await fetch('/api/progress', { method: 'DELETE' }).catch(() => undefined)
}

export async function removeRemoteProject(id: string) {
  if (current) await fetch(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => undefined)
}
