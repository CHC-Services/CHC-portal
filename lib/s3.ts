import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { createPresignedPost } from '@aws-sdk/s3-presigned-post'

const clientConfig = {
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
}

// Standard client for server-side operations
const s3 = new S3Client(clientConfig)

// Presign client with checksums disabled — browser uploads can't compute them
const s3Presign = new S3Client({
  ...clientConfig,
  requestChecksumCalculation: 'WHEN_REQUIRED' as any,
  responseChecksumValidation: 'WHEN_REQUIRED' as any,
})

const BUCKET = process.env.AWS_S3_BUCKET!

/** Upload a file buffer to S3. Stored private with AES-256 encryption at rest. */
export async function uploadToS3(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
    ServerSideEncryption: 'AES256',
  }))
}

/** Permanently delete an object from S3. */
export async function deleteFromS3(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  }))
}

/**
 * Generate a short-lived presigned POST policy so the browser can upload
 * directly to S3 without routing bytes through Next.js / Vercel.
 * Uses multipart/form-data POST — no CORS preflight is triggered.
 * Returns { url, fields } — browser POSTs form data to url with fields included.
 */
export async function getPresignedPost(
  key: string,
  contentType: string,
  expiresInSeconds = 900,
): Promise<{ url: string; fields: Record<string, string> }> {
  return createPresignedPost(s3Presign, {
    Bucket: BUCKET,
    Key: key,
    Conditions: [
      ['content-length-range', 0, 52428800], // 50MB max
      ['eq', '$Content-Type', contentType],
    ],
    Fields: { 'Content-Type': contentType },
    Expires: expiresInSeconds,
  })
}

/**
 * Generate a short-lived presigned GET URL for a private S3 object.
 * Default expiry: 15 minutes. The URL grants read access to that one object
 * and expires automatically — no permanent public access is ever granted.
 */
export async function getPresignedDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
  return getSignedUrl(
    s3Presign,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: expiresInSeconds },
  )
}
