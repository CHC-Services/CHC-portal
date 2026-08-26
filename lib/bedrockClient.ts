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

arrivalFindings is plain prose — a one-time initial assessment, not a chronological log. It NEVER starts with or contains a timestamp of any kind, not even a single leading one for the whole block — the assumption is always that arrival findings happened at shift start, so restating a time adds nothing and must not appear. This holds even if the dictated content itself mentions a specific clock time in passing (e.g. "arrived at 7am and found...") — drop that time reference entirely rather than turning it into a leading timestamp; the surrounding words (like "arrived and found...") still read fine without it. If nothing qualifies for arrivalFindings, return an empty string; do not manufacture content to fill it.

## Narrative

Your job here has exactly two parts, and they must not blur together:

1. REWRITE phrasing into professional clinical language, and CORRECT obvious speech-recognition errors. A raw transcript is machine-generated from audio and can mishear a word — if a word or phrase makes little sense in context but a common clinical term does (e.g. a transcript reads "G-tube is Peyton and clean dry intact" — "Peyton" has near-zero contextual probability in a tube-site assessment, and "patent" is the obviously intended, standard clinical term), correct it. This is recovering what was actually said, not inventing anything.

2. NEVER add any clinical finding, observation, action, medication, quantity, time, or route that was not stated or clearly implied by what was actually dictated. If a word or phrase is genuinely ambiguous — no single reading is clearly favored by context — do not guess. Leave it as close to verbatim as possible and wrap your best-effort rendering in [unclear — please review] so the nurse notices and fixes it herself.

## Extracting multiple times from one entry (narrative only)

This section applies to the narrative field ONLY — never to arrivalFindings, which per the rule above never gets any timestamp at all, no matter how many times or durations are mentioned within its content.

A single dictated entry can describe a run of several distinct events that happened at different points during the shift, not just one moment — split it into one narrative line per distinct time, not one line for the whole entry. Two ways a new time reveals itself within an entry's own text:
- An explicit clock time is stated (e.g. "at 6:15am", "at 7") — convert it to 4-digit 24-hour military format.
- A duration was given for the activity just described (e.g. "for 10 minutes", "lasted 10 min") and the entry then moves on to a new, distinct action — add that duration to the running clock to get that next action's start time. Only advance the clock this way when a new distinct action actually follows; a duration describing the entry's only activity doesn't need a second line.

Each extracted or computed time becomes the timestamp prefix for its own narrative line — this takes priority over the entry's own recorded-at time, which only applies when nothing in the entry's own text lets you resolve a more specific time — and determines that line's chronological position among every other line in the narrative, same one-blank-line-between-entries formatting as everywhere else.

If an entry mentions no clock time and no duration that would let you compute one, it stays a single line using its own recorded time, exactly as before.

Example — one entry, several actions:
Raw: "Patient woke up at 6:15am and was placed on the toilet for 10min before moving back to room to start CPT therapy, lasted 10min, tolerated well. Got patient dressed for day after that. Hair styled and oncoming nurse arrived at 7am, report was provided and care handed over."

Compiles to:
0615 - Patient woke up and was placed on the toilet for 10 minutes.

0625 - Patient moved back to his room to complete CPT vest treatment. Tolerated well.

0635 - Patient dressed for the day. Hair styled.

0700 - Oncoming nurse arrived, report provided, and care handed over.

Formatting rules for the narrative:
- One line per entry (or per remaining portion of an entry after any arrivalFindings split, or per extracted time within an entry per the rule above), prefixed with its time in 24-hour military format (e.g. "1732 - ...").
- Exactly one blank line between entries.
- Preserve every quantity, time, and route exactly as stated — do not round, estimate, or normalize units.
- Use entries' relative references to each other (e.g. "after he was done throwing up") to resolve which earlier entry they refer to, but only within what was actually said across the entries — never invent a connection that isn't supported by the entries themselves.
- The narrative field itself contains ONLY the compiled note text — no preamble, no explanation, no markdown.

## Vitals and Intake/Output rows

Separately from the narrative, pull out anything dictated that is actually a vital sign (temperature, heart rate, respiratory rate, skin condition, O2 flow/route/percent, lung sounds, whether treatment/suction was needed) or an intake/output event (food/fluid intake by type and amount and route, urine/BM/emesis output amounts) into their own rows.

This is the same "never invent, only what was actually said" rule as the narrative, applied to structured data — which makes it MORE important to follow strictly here, not less: a wrong number in a table reads as an established fact, not prose a reader will naturally read critically.

- Every row needs a time (24-hour military format, matching the narrative's own time for that entry).
- Vitals rows specifically: every field always gets a value, never omitted — fill in whatever was actually mentioned for that timestamp, and for every OTHER vitals field not mentioned at that same timestamp, put the literal string "-" instead of leaving it blank. This makes clear the field was considered and genuinely wasn't dictated, not skipped. Do not infer a real value just to avoid using "-" (e.g. don't assume O2 route just because O2 percent was mentioned — that still gets "-").
- Intake/Output rows are different: only fill in the specific fields actually mentioned for that row and leave every other field blank (no "-") — a row is deliberately single-purpose (one intake type/amount/route, or one output type), not a full checklist the way a vitals row is.
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

// recordedAt is a real UTC instant (DateTime @default(now())) — correct and
// unambiguous in storage. But this function runs in the Vercel serverless
// function, not the nurse's browser, so toLocaleTimeString() with no
// explicit timeZone would render in the SERVER's timezone, not hers —
// timeZone must be passed in from the client (Intl.DateTimeFormat's
// resolvedOptions().timeZone) for the compiled note's timestamps to match
// what she actually saw on her device when she recorded each entry.
function formatEntriesForPrompt(entries: CompileVoiceEntry[], timeZone: string): string {
  return entries
    .map(e => {
      const time = e.recordedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone })
      const tag = e.entryType === 'arrival' ? 'ARRIVAL' : 'SHIFT'
      return `[${time}] [${tag}] ${e.rawText}`
    })
    .join('\n')
}

const ROW_STRING = { type: 'string' } as const
// Vitals fields always get a value — "-" when that specific metric wasn't
// mentioned at this row's timestamp, per the "-" convention above. Required
// (not just time) so the model can't silently omit an unmentioned field
// instead of writing "-" into it.
const VITALS_FIELD = { type: 'string', description: 'The actual value if mentioned at this row\'s timestamp, otherwise the literal string "-".' } as const

const TOOL_SCHEMA = {
  type: 'object',
  properties: {
    narrative: { type: 'string', description: 'The compiled, professionally-worded shift note text.' },
    arrivalFindings: { type: 'string', description: 'Plain-prose arrival findings, split out per the splitting rules. No timestamp prefix, ever — not even one leading time for the whole block. Empty string if none.' },
    vitals: {
      type: 'array',
      description: 'One row per distinct vitals reading actually dictated. Empty array if none.',
      items: {
        type: 'object',
        properties: {
          time: ROW_STRING, temp: VITALS_FIELD, hr: VITALS_FIELD, rr: VITALS_FIELD, skin: VITALS_FIELD,
          o2Flow: VITALS_FIELD, o2Route: VITALS_FIELD, o2Percent: VITALS_FIELD,
          lungSounds: VITALS_FIELD, txNeeded: VITALS_FIELD, suction: VITALS_FIELD,
        },
        required: ['time', 'temp', 'hr', 'rr', 'skin', 'o2Flow', 'o2Route', 'o2Percent', 'lungSounds', 'txNeeded', 'suction'],
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
// timeZone: IANA zone from the nurse's own device (e.g. "America/New_York"),
// passed by the client at compile time. Falls back to the agency's home
// timezone if a caller doesn't supply one, rather than silently defaulting
// to the server's — nobody using this app is actually in UTC.
export async function compileVoiceEntries(entries: CompileVoiceEntry[], timeZone: string = 'America/New_York'): Promise<CompileResult> {
  const userText = `Here are this shift's dictated entries, already in chronological order:\n\n${formatEntriesForPrompt(entries, timeZone)}`

  const response = await client.send(new ConverseCommand({
    modelId: MODEL_ID,
    // SYSTEM_PROMPT is identical on every call — only the user message
    // (this shift's entries) changes — so it's the ideal cache candidate.
    // 1h ttl over the default 5m: compiles happen occasionally rather than
    // in a constant stream, so the wider window is far more likely to
    // actually get reused (a nurse's shift + arrival compile, or several
    // testers compiling within the same hour) before it expires.
    system: [{ text: SYSTEM_PROMPT }, { cachePoint: { type: 'default', ttl: '1h' } }],
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
