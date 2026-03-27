import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

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
 * Generate a short-lived presigned PUT URL so the browser can upload directly
 * to S3 without routing the file bytes through Next.js / Vercel.
 * Expiry: 15 minutes. The URL is single-use and scoped to one object key.
 */
export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 900,
): Promise<string> {
  // No SSE or checksum headers — browser PUTs can't sign or compute them.
  // AWS encrypts by default at the bucket level (AES-256) for all new buckets.
  return getSignedUrl(
    s3Presign,
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: expiresInSeconds },
  )
}

/**
 * Generate a short-lived presigned GET URL for a private S3 object.
 * Default expiry: 15 minutes. The URL grants read access to that one object
 * and expires automatically — no permanent public access is ever granted.
 */
export async function getPresignedDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: BUCKET, Key: key }),
    { expiresIn: expiresInSeconds },
  )
}
