import { spawn } from 'node:child_process'
import { gunzipSync } from 'node:zlib'
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import pg from 'pg'
import type { Client } from 'pg'
import { bucket, s3 } from './storage.js'

// A backup nobody has restored is not a backup: this restores the newest one into a scratch database and checks it.
const SCRATCH = 'pipeline_lab_restore_check'
const live = process.env.DATABASE_URL!
const scratch = new URL(live)
scratch.pathname = `/${SCRATCH}`

// Expiry keeps a few weeks of backups, well inside one listing page.
const { Contents = [] } = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: 'pipeline-lab-' }))
const newest = Contents.map((object) => object.Key!).sort().at(-1)
if (!newest) throw new Error(`there are no backups in ${bucket}`)

const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: newest }))
const sql = gunzipSync(await object.Body!.transformToByteArray())

const count = async (client: Client, table: string) => Number((await client.query(`select count(*) from ${table}`)).rows[0].count)

const admin = new pg.Client({ connectionString: live })
await admin.connect()
try {
  await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH}`)
  await admin.query(`CREATE DATABASE ${SCRATCH}`)

  // psql rather than the pg client: a plain dump loads its rows with COPY ... FROM stdin.
  const psql = spawn('psql', ['--quiet', '--set', 'ON_ERROR_STOP=1', '--dbname', scratch.toString()], {
    stdio: ['pipe', 'ignore', 'inherit'],
  })
  const restored = new Promise<number | null>((resolve) => psql.on('close', resolve))
  psql.stdin.end(sql)
  if ((await restored) !== 0) throw new Error(`restoring ${newest} failed`)

  const check = new pg.Client({ connectionString: scratch.toString() })
  await check.connect()
  try {
    // A missing table makes its count fail, which fails the drill.
    for (const table of ['"user"', 'account', 'session', 'learner', 'project', 'drizzle.__drizzle_migrations']) {
      console.log(`${table}: ${await count(check, table)} restored, ${await count(admin, table)} live now`)
    }
    if ((await count(check, 'drizzle.__drizzle_migrations')) === 0) throw new Error('the restored database has no migrations recorded')
  } finally {
    await check.end()
  }
  console.log(`restored ${newest} into a scratch database and checked it`)
} finally {
  await admin.query(`DROP DATABASE IF EXISTS ${SCRATCH}`)
  await admin.end()
}
