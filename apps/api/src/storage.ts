import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketLifecycleConfigurationCommand,
  S3Client,
} from '@aws-sdk/client-s3'

export const bucket = process.env.S3_BUCKET!

// MinIO locally, Cloudflare R2 on a server: both speak the S3 API, so only these settings change.
export const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? 'auto',
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
})

// Creates the local MinIO bucket on first use. On R2 the bucket and its expiry rule are set up once, by hand.
export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucket }))
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: bucket }))
    // 29 days, not 30: expiry can run up to a day late, and the privacy page says copies are gone within 30.
    await s3.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: bucket,
        LifecycleConfiguration: {
          Rules: [{ ID: 'expire-backups', Status: 'Enabled', Filter: { Prefix: '' }, Expiration: { Days: 29 } }],
        },
      }),
    )
  }
}
