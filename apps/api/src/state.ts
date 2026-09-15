import { and, eq, sql } from 'drizzle-orm'
import { user } from './auth-schema.js'
import { db } from './db.js'
import { mergeState, type State } from './merge.js'
import { learner, project } from './schema.js'

export const MAX_PROJECTS = 50

export class TooManyProjects extends Error {}

async function readState(reader: Pick<typeof db, 'select'>, userId: string): Promise<State> {
  const [row] = await reader.select().from(learner).where(eq(learner.userId, userId))
  const projects = await reader.select().from(project).where(eq(project.userId, userId))
  return {
    lessons: row?.lessons ?? {},
    scenarios: row?.scenarios ?? {},
    projects: Object.fromEntries(
      projects.map((p) => [p.id, { id: p.id, name: p.name, source: p.source, updatedAt: p.updatedAt.toISOString() }]),
    ),
  }
}

export function syncState(userId: string, incoming: State): Promise<State> {
  return db.transaction(async (tx) => {
    await tx.insert(learner).values({ userId }).onConflictDoNothing()
    // Two devices syncing at once would otherwise read the same row and lose one update.
    await tx.select({ userId: learner.userId }).from(learner).where(eq(learner.userId, userId)).for('update')

    const merged = mergeState(await readState(tx, userId), incoming)
    const projects = Object.values(merged.projects)
    if (projects.length > MAX_PROJECTS) throw new TooManyProjects()

    await tx
      .update(learner)
      .set({ lessons: merged.lessons, scenarios: merged.scenarios, updatedAt: new Date() })
      .where(eq(learner.userId, userId))

    if (projects.length > 0) {
      await tx
        .insert(project)
        .values(projects.map((p) => ({ ...p, userId, updatedAt: new Date(p.updatedAt) })))
        .onConflictDoUpdate({
          target: project.id,
          set: { name: sql`excluded.name`, source: sql`excluded.source`, updatedAt: sql`excluded.updated_at` },
          // An id that belongs to another account matches nothing, so it is never overwritten.
          setWhere: eq(project.userId, userId),
        })
    }

    // Read back rather than trust the merge, so another account's id never looks saved.
    return readState(tx, userId)
  })
}

// ponytail: a device offline during a reset pushes its old progress back; add a clearedAt and drop older records if that bites.
export async function clearProgress(userId: string) {
  await db.update(learner).set({ lessons: {}, scenarios: {}, updatedAt: new Date() }).where(eq(learner.userId, userId))
}

export async function deleteProject(userId: string, id: string) {
  const deleted = await db
    .delete(project)
    .where(and(eq(project.id, id), eq(project.userId, userId)))
    .returning({ id: project.id })
  return deleted.length > 0
}

// Account fields are listed one by one, so a column added later is never exported by accident.
export async function exportAccount(userId: string) {
  const [account] = await db
    .select({ email: user.email, name: user.name, emailVerified: user.emailVerified, createdAt: user.createdAt })
    .from(user)
    .where(eq(user.id, userId))
  return { exportedAt: new Date().toISOString(), account, ...(await readState(db, userId)) }
}
