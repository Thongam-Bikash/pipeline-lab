import { spawn } from 'node:child_process'
import { buffer } from 'node:stream/consumers'
import { createGzip } from 'node:zlib'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { bucket, ensureBucket, s3 } from './storage.js'

// ponytail: holds the whole compressed dump in memory; stream the upload with @aws-sdk/lib-storage past ~100 MB.
const dump = spawn('pg_dump', ['--no-owner', '--no-acl', '--dbname', process.env.DATABASE_URL!], {
  stdio: ['ignore', 'pipe', 'inherit'],
})
const exited = new Promise<number | null>((resolve) => dump.on('close', resolve))
const body = await buffer(dump.stdout.pipe(createGzip()))
if ((await exited) !== 0) throw new Error('pg_dump failed, so nothing was uploaded')

// Named by time, so the newest backup is simply the last key in sorted order.
const key = `pipeline-lab-${new Date().toISOString().replace(/\.\d+Z$/, 'Z').replaceAll(':', '')}.sql.gz`
await ensureBucket()
await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/gzip' }))
console.log(`backed up ${key} (${body.byteLength} bytes)`)
