import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'

// Micro-Charting's compile step — the ONE call that turns a shift's raw
// dictated voice entries into professional clinical narrative. Always one
// call over every entry together, never one call per entry — only a
// whole-shift call can resolve a later entry's context back to an earlier
// one (e.g. "after he was done throwing up" referring to an earlier emesis
// entry), and it has more to reason from when correcting an obvious
// speech-recognition misfire than an isolated single-entry pass would.

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

// Set this to the exact model ID shown in the Bedrock console's Model
// catalog for whichever Claude model you want (Bedrock model IDs don't
// match Anthropic's own model names 1:1, and change as new models ship —
// copy it directly from the console rather than guessing).
const MODEL_ID = process.env.BEDROCK_MODEL_ID!

const SYSTEM_PROMPT = `You are helping a home health nurse turn her own raw, dictated shift notes into a professionally-worded clinical progress note entry. You will be given a list of short voice-dictated entries from one shift, each with the time it was recorded, already in chronological order.

Your job has exactly two parts, and they must not blur together:

1. REWRITE phrasing into professional clinical language, and CORRECT obvious speech-recognition errors. A raw transcript is machine-generated from audio and can mishear a word — if a word or phrase makes little sense in context but a common clinical term does (e.g. a transcript reads "G-tube is Peyton and clean dry intact" — "Peyton" has near-zero contextual probability in a tube-site assessment, and "patent" is the obviously intended, standard clinical term), correct it. This is recovering what was actually said, not inventing anything.

2. NEVER add any clinical finding, observation, action, medication, quantity, time, or route that was not stated or clearly implied by what was actually dictated. If a word or phrase is genuinely ambiguous — no single reading is clearly favored by context — do not guess. Leave it as close to verbatim as possible and wrap your best-effort rendering in [unclear — please review] so the nurse notices and fixes it herself.

Formatting rules:
- One line per entry, prefixed with its time in 24-hour military format (e.g. "1732 - ...").
- Exactly one blank line between entries.
- Preserve every quantity, time, and route exactly as stated — do not round, estimate, or normalize units.
- Use entries' relative references to each other (e.g. "after he was done throwing up") to resolve which earlier entry they refer to, but only within what was actually said across the entries — never invent a connection that isn't supported by the entries themselves.
- Output ONLY the compiled note text. No preamble, no explanation, no markdown formatting.`

export type CompileVoiceEntry = { recordedAt: Date; rawText: string }

function formatEntriesForPrompt(entries: CompileVoiceEntry[]): string {
  return entries
    .map(e => {
      const time = e.recordedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      return `[${time}] ${e.rawText}`
    })
    .join('\n')
}

/** Sends one Converse call over every entry in a shift together. Returns the
 * compiled narrative text only — never writes it anywhere itself, per the
 * "never silently overwrite" requirement; the caller decides what to do
 * with the result. */
export async function compileVoiceEntries(entries: CompileVoiceEntry[]): Promise<string> {
  const userText = `Here are this shift's dictated entries, already in chronological order:\n\n${formatEntriesForPrompt(entries)}`

  const response = await client.send(new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: SYSTEM_PROMPT }],
    messages: [{ role: 'user', content: [{ text: userText }] }],
    inferenceConfig: { maxTokens: 2000, temperature: 0.2 },
  }))

  const message = response.output?.message
  const content = message?.content || []
  const textBlock = content.find((b): b is { text: string } => 'text' in b)
  return textBlock?.text || ''
}
