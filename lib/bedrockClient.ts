import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime'
import { O2_ROUTES, TX_NEEDED, INTAKE_ROUTES } from './clinicalOptions'

// Micro-Charting's compile step — the ONE call that turns a shift's raw
// dictated voice entries into professional clinical narrative, PLUS
// structured Vitals and Intake/Output table rows for anything dictated that
// was actually a vital sign or intake/output event. Always one call over
// every entry together, never one call per entry — only a whole-shift call
// can resolve a later entry's context back to an earlier one (e.g. "after he
// was done throwing up" referring to an earlier emesis entry), and it has
// more to reason from when correcting an obvious speech-recognition misfire
// than an isolated single-entry pass would.

// Deliberately its own env var, not AWS_REGION — that one is shared by
// lib/s3.ts and lib/awsTranscribe.ts, and S3 buckets are locked to the region
// they were created in. Bedrock model access is region-specific in a
// different way (which regions have your model access approved), so forcing
// all three services to agree on one region was never going to work long
// term — this keeps Bedrock's region independently configurable.
const client = new BedrockRuntimeClient({
  region: process.env.BEDROCK_AWS_REGION!,
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


const ARRIVAL_CUE_PHRASES = [
  'arrival findings', 'upon arrival', 'on arrival', 'at arrival',
  'report received from', 'report provided by', 'writer received report',
  'received report from', 'report given by', 'handoff from',
]

const SYSTEM_PROMPT = `You are helping a home health nurse turn her own raw, dictated shift notes into a professionally-worded clinical progress note. You will be given a list of short voice-dictated entries from one shift, each with the time it was recorded and a tag of [ARRIVAL] or [SHIFT] showing which record button she pressed, already in chronological order.

You must call the submit_compiled_note tool exactly once with four things: a narrative, an arrivalFindings text, a list of vitals rows, and a list of intake/output rows.

## Splitting content between narrative and arrivalFindings

Every entry tagged [ARRIVAL] belongs entirely in arrivalFindings, never in the narrative.

For [SHIFT]-tagged entries, ALSO watch for any of these phrases appearing anywhere inside the entry's own text, regardless of the tag: ${ARRIVAL_CUE_PHRASES.map(p => `"${p}"`).join(', ')}. If one appears, move that portion of the entry (from the cue phrase to wherever the arrival-related content ends) into arrivalFindings instead of the narrative — a nurse who forgot to press the Arrival Finding button but said one of these phrases anyway still gets it routed correctly. The rest of that same entry, if any, still goes in the narrative as normal.

arrivalFindings is plain prose — a one-time initial assessment, not a chronological log — so do NOT prefix it with per-entry timestamps the way the narrative is. If nothing qualifies for arrivalFindings, return an empty string; do not manufacture content to fill it.

## Narrative

Your job here has exactly two parts, and they must not blur together:

1. REWRITE phrasing into professional clinical language, and CORRECT obvious speech-recognition errors. A raw transcript is machine-generated from audio and can mishear a word — if a word or phrase makes little sense in context but a common clinical term does (e.g. a transcript reads "G-tube is Peyton and clean dry intact" — "Peyton" has near-zero contextual probability in a tube-site assessment, and "patent" is the obviously intended, standard clinical term), correct it. This is recovering what was actually said, not inventing anything.

2. NEVER add any clinical finding, observation, action, medication, quantity, time, or route that was not stated or clearly implied by what was actually dictated. If a word or phrase is genuinely ambiguous — no single reading is clearly favored by context — do not guess. Leave it as close to verbatim as possible and wrap your best-effort rendering in [unclear — please review] so the nurse notices and fixes it herself.

Formatting rules for the narrative:
- One line per entry (or per remaining portion of an entry after any arrivalFindings split), prefixed with its time in 24-hour military format (e.g. "1732 - ...").
- Exactly one blank line between entries.
- Preserve every quantity, time, and route exactly as stated — do not round, estimate, or normalize units.
- Use entries' relative references to each other (e.g. "after he was done throwing up") to resolve which earlier entry they refer to, but only within what was actually said across the entries — never invent a connection that isn't supported by the entries themselves.
- The narrative field itself contains ONLY the compiled note text — no preamble, no explanation, no markdown.

## Vitals and Intake/Output rows

Separately from the narrative, pull out anything dictated that is actually a vital sign (temperature, heart rate, respiratory rate, skin condition, O2 flow/route/percent, lung sounds, whether treatment/suction was needed) or an intake/output event (food/fluid intake by type and amount and route, urine/BM/emesis output amounts) into their own rows.

This is the same "never invent, only what was actually said" rule as the narrative, applied to structured data — which makes it MORE important to follow strictly here, not less: a wrong number in a table reads as an established fact, not prose a reader will naturally read critically.

- Every row needs a time (24-hour military format, matching the narrative's own time for that entry).
- Only fill in the specific fields that were actually mentioned for that row — leave every other field on that row blank. Do not infer a value (e.g. don't assume O2 route just because O2 percent was mentioned).
- If an entry mentions more than one intake or output type (e.g. "gave a 200mL feed, flushed with 30mL water"), that is TWO separate intake/output rows — one row can only hold one intake type and one output type, never both a feed amount and a flush amount packed together.
- For O2 route, only use one of: ${O2_ROUTES.join(', ')} — leave blank if what was said doesn't clearly match one of these.
- For "treatment needed" (txNeeded), only use one of: ${TX_NEEDED.join(', ')} — leave blank if not stated either way.
- For intake route, only use one of: ${INTAKE_ROUTES.join(', ')} — leave blank if what was said doesn't clearly match one of these.
- If nothing in the shift's entries was actually a vital sign or intake/output event, return empty arrays for both — do not manufacture rows to have something to report.`

export type CompileVoiceEntry = { recordedAt: Date; rawText: string; entryType: string }

export type ExtractedVitalRow = {
  time: string
  temp?: string; hr?: string; rr?: string; skin?: string
  o2Flow?: string; o2Route?: string; o2Percent?: string
  lungSounds?: string; txNeeded?: string; suction?: string
}
export type ExtractedIntakeOutputRow = {
  time: string
  intakeType?: string; intakeAmt?: string; intakeRoute?: string
  outputUrine?: string; outputBM?: string; outputEmesis?: string
}
export type CompileResult = {
  narrative: string
  arrivalFindings: string
  vitals: ExtractedVitalRow[]
  intakeOutput: ExtractedIntakeOutputRow[]
}

function formatEntriesForPrompt(entries: CompileVoiceEntry[]): string {
  return entries
    .map(e => {
      const time = e.recordedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
      const tag = e.entryType === 'arrival' ? 'ARRIVAL' : 'SHIFT'
      return `[${time}] [${tag}] ${e.rawText}`
    })
    .join('\n')
}

const ROW_STRING = { type: 'string' } as const

const TOOL_SCHEMA = {
  type: 'object',
  properties: {
    narrative: { type: 'string', description: 'The compiled, professionally-worded shift note text.' },
    arrivalFindings: { type: 'string', description: 'Plain-prose arrival findings, split out per the splitting rules. Empty string if none.' },
    vitals: {
      type: 'array',
      description: 'One row per distinct vitals reading actually dictated. Empty array if none.',
      items: {
        type: 'object',
        properties: {
          time: ROW_STRING, temp: ROW_STRING, hr: ROW_STRING, rr: ROW_STRING, skin: ROW_STRING,
          o2Flow: ROW_STRING, o2Route: ROW_STRING, o2Percent: ROW_STRING,
          lungSounds: ROW_STRING, txNeeded: ROW_STRING, suction: ROW_STRING,
        },
        required: ['time'],
      },
    },
    intakeOutput: {
      type: 'array',
      description: 'One row per distinct intake or output event actually dictated. Empty array if none.',
      items: {
        type: 'object',
        properties: {
          time: ROW_STRING, intakeType: ROW_STRING, intakeAmt: ROW_STRING, intakeRoute: ROW_STRING,
          outputUrine: ROW_STRING, outputBM: ROW_STRING, outputEmesis: ROW_STRING,
        },
        required: ['time'],
      },
    },
  },
  required: ['narrative', 'arrivalFindings', 'vitals', 'intakeOutput'],
}

/** Sends one Converse call over every entry in a shift together. Returns the
 * compiled narrative plus extracted Vitals/Intake-Output rows — never writes
 * any of it anywhere itself, per the "never silently overwrite" requirement;
 * the caller decides what to do with the result. */
export async function compileVoiceEntries(entries: CompileVoiceEntry[]): Promise<CompileResult> {
  const userText = `Here are this shift's dictated entries, already in chronological order:\n\n${formatEntriesForPrompt(entries)}`

  const response = await client.send(new ConverseCommand({
    modelId: MODEL_ID,
    system: [{ text: SYSTEM_PROMPT }],
    messages: [{ role: 'user', content: [{ text: userText }] }],
    inferenceConfig: { maxTokens: 3000, temperature: 0.2 },
    toolConfig: {
      tools: [{
        toolSpec: {
          name: 'submit_compiled_note',
          description: 'Submit the compiled narrative and extracted structured rows for this shift.',
          inputSchema: { json: TOOL_SCHEMA },
        },
      }],
      toolChoice: { tool: { name: 'submit_compiled_note' } },
    },
  }))

  const content = response.output?.message?.content || []
  const toolUseBlock = content.find(b => 'toolUse' in b && b.toolUse)
  const input = toolUseBlock?.toolUse?.input as Partial<CompileResult> | undefined

  return {
    narrative: input?.narrative || '',
    arrivalFindings: input?.arrivalFindings || '',
    vitals: Array.isArray(input?.vitals) ? input.vitals : [],
    intakeOutput: Array.isArray(input?.intakeOutput) ? input.intakeOutput : [],
  }
}
