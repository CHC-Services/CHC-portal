import { TranscribeClient, StartMedicalTranscriptionJobCommand, GetMedicalTranscriptionJobCommand } from '@aws-sdk/client-transcribe'
import { uploadToS3, getObjectText, deleteFromS3 } from './s3'

// Micro-Charting's transcription pipeline — AWS Transcribe Medical, job-based
// (StartMedicalTranscriptionJobCommand requires the input audio to already be
// in S3; it can't take bytes inline). Every temp object this creates is
// deleted the moment its job settles (see cleanup() below) — audio and its
// transcript JSON never outlive the single request that consumes them.

const clientConfig = {
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
}

const transcribe = new TranscribeClient(clientConfig)
const BUCKET = process.env.AWS_S3_BUCKET!

type MediaFormat = 'webm' | 'wav' | 'mp3' | 'ogg' | 'mp4' | 'm4a' | 'flac'

function mediaFormatFromContentType(contentType: string): MediaFormat {
  if (contentType.includes('webm')) return 'webm'
  if (contentType.includes('wav')) return 'wav'
  if (contentType.includes('mp3') || contentType.includes('mpeg')) return 'mp3'
  if (contentType.includes('ogg')) return 'ogg'
  if (contentType.includes('mp4')) return 'mp4'
  if (contentType.includes('m4a')) return 'm4a'
  if (contentType.includes('flac')) return 'flac'
  return 'webm' // browser MediaRecorder's default output
}

function tempKeys(jobId: string) {
  return {
    inputKey: `voice-entries/tmp/${jobId}/input`,
    outputKey: `voice-entries/tmp/${jobId}/output.json`,
  }
}

async function cleanup(inputKey: string, outputKey: string) {
  await Promise.all([
    deleteFromS3(inputKey).catch(() => {}),
    deleteFromS3(outputKey).catch(() => {}),
  ])
}

/** Uploads one recorded voice-entry clip to a temp S3 key and starts a
 * Medical/DICTATION transcription job against it. Returns just the jobId —
 * both temp S3 keys are deterministically derivable from it (see
 * tempKeys() above), so the caller never needs to round-trip anything else
 * to later poll checkTranscription(). */
export async function startTranscription(audio: Buffer, contentType: string): Promise<{ jobId: string }> {
  const jobId = crypto.randomUUID()
  const format = mediaFormatFromContentType(contentType)
  const { inputKey, outputKey } = tempKeys(jobId)

  await uploadToS3(inputKey, audio, contentType)

  await transcribe.send(new StartMedicalTranscriptionJobCommand({
    MedicalTranscriptionJobName: jobId,
    LanguageCode: 'en-US', // the only value Transcribe Medical accepts
    MediaFormat: format,
    Media: { MediaFileUri: `s3://${BUCKET}/${inputKey}` },
    OutputBucketName: BUCKET,
    OutputKey: outputKey,
    Specialty: 'PRIMARYCARE', // the only value batch Transcribe Medical accepts
    Type: 'DICTATION', // one speaker, not a two-person conversation
  }))

  return { jobId }
}

export type TranscriptionStatus =
  | { status: 'IN_PROGRESS' }
  | { status: 'COMPLETED'; text: string }
  | { status: 'FAILED'; reason: string }

/** Polls one job. On COMPLETED or FAILED, always cleans up both the temp
 * input audio and output transcript JSON before returning — this is the
 * only place either gets deleted, so every caller must actually call this
 * through to a settled state, not abandon polling early. */
export async function checkTranscription(jobId: string): Promise<TranscriptionStatus> {
  const { inputKey, outputKey } = tempKeys(jobId)
  const { MedicalTranscriptionJob: job } = await transcribe.send(
    new GetMedicalTranscriptionJobCommand({ MedicalTranscriptionJobName: jobId }),
  )

  const jobStatus = job?.TranscriptionJobStatus
  if (jobStatus === 'IN_PROGRESS' || jobStatus === 'QUEUED') {
    return { status: 'IN_PROGRESS' }
  }

  if (jobStatus === 'FAILED') {
    await cleanup(inputKey, outputKey)
    return { status: 'FAILED', reason: job?.FailureReason || 'Transcription failed.' }
  }

  // COMPLETED
  const raw = await getObjectText(outputKey)
  const parsed = JSON.parse(raw)
  const text: string = parsed?.results?.transcripts?.[0]?.transcript || ''
  await cleanup(inputKey, outputKey)
  return { status: 'COMPLETED', text }
}
