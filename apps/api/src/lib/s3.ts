import { S3Client, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { env } from './env.js'

export const s3 = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
  forcePathStyle: true,
})

export async function uploadToS3(params: {
  key: string
  body: Buffer
  contentType: string
}): Promise<string> {
  const upload = new Upload({
    client: s3,
    params: {
      Bucket: env.S3_BUCKET,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType,
    },
  })
  await upload.done()
  return `${env.S3_PUBLIC_URL}/${params.key}`
}

export async function deleteFromS3(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }))
}

const PUBLIC_READ_POLICY = JSON.stringify({
  Version: '2012-10-17',
  Statement: [{
    Effect: 'Allow',
    Principal: '*',
    Action: ['s3:GetObject'],
    Resource: [`arn:aws:s3:::${env.S3_BUCKET}/*`],
  }],
})

export async function initS3Bucket() {
  // Non-fatal: if object storage is unreachable (not yet configured), the API still
  // boots — only media uploads will fail until S3/R2 is set up.
  try {
    try {
      await s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }))
    } catch {
      await s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }))
    }
    // Always ensure public-read policy (idempotent)
    await s3.send(new PutBucketPolicyCommand({ Bucket: env.S3_BUCKET, Policy: PUBLIC_READ_POLICY }))
  } catch (err) {
    console.warn('[s3] Bucket init atlandı — depolama erişilemez. Medya yüklemeleri S3/R2 ayarlanana kadar çalışmayacak.', (err as Error).message)
  }
}
