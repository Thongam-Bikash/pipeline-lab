import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'

// Runs as a one-shot container before the API starts. Applied migrations are recorded,
// so running it again changes nothing.
const db = drizzle(process.env.DATABASE_URL!)
await migrate(db, { migrationsFolder: 'drizzle' })
await db.$client.end()
console.log('migrations applied')
