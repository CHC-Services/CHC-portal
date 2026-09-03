import type { Browser } from 'puppeteer-core'
import { existsSync } from 'fs'

// Local headless Chrome launches were intermittently failing outright
// ("Failed to launch the browser process: Code: null", no stderr). Turned
// out to be macOS denying Chrome's internal sandbox IPC (Mach port
// rendezvous) rather than a corrupted/missing binary — confirmed by running
// with `dumpio: true`, which surfaced "bootstrap_look_up
// com.google.chrome.for.testing.MachPortRendezvousServer: Permission denied"
// even though the same binary launched cleanly moments later. --no-sandbox
// sidesteps that OS-level IPC entirely rather than depending on it working.
// (Production never hits this path — Vercel's Lambda runtime uses
// @sparticuz/chromium in the else branch below, already unsandboxed by
// nature of that environment.)
const LOCAL_LAUNCH_ARGS = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']

// If a real Chrome install is ever preferred over Puppeteer's own
// auto-downloaded copy, PUPPETEER_EXECUTABLE_PATH (or one of these common
// paths) wins — but as of the sandbox-args fix above, the bundled copy works
// fine on its own; this is just a manual override, not a required fallback.
const COMMON_LOCAL_CHROME_PATHS = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
]

function findLocalChromeExecutable(): string | null {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }
  return COMMON_LOCAL_CHROME_PATHS.find(existsSync) ?? null
}

// Renders an HTML string to a PDF buffer using headless Chromium.
// @sparticuz/chromium provides a binary compatible with Vercel's serverless
// runtime; puppeteer-core drives it without bundling a full Chromium download.
export async function generatePdfFromHtml(html: string, options: {
  landscape?: boolean
  // Repeating header/footer across however many pages the content naturally
  // spans (Chromium's print engine doesn't support CSS @page margin boxes,
  // so this is the only reliable way to get a running "Page X of Y" strip on
  // a document of unknown length — see lib/progressNoteHtml.ts for the
  // motivating case). All three are passed straight through to page.pdf();
  // omitted entirely, nothing changes for existing callers.
  displayHeaderFooter?: boolean
  headerTemplate?: string
  footerTemplate?: string
  // Per-side overrides on top of the computed default (e.g. extra left
  // clearance for hole-punching/binders) — omit any side to keep the default
  // for that side. Existing callers that don't pass this see no change.
  margin?: { top?: string; bottom?: string; left?: string; right?: string }
} = {}): Promise<Buffer> {
  const isLocal = !process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.VERCEL

  let browser: Browser
  if (isLocal) {
    // Local dev — prefer a real installed Chrome (see findLocalChromeExecutable
    // above); fall back to the full `puppeteer` package's bundled Chromium
    // (devDependency only) if no system install is found. Neither path touches
    // production, which always uses the Lambda-only @sparticuz/chromium binary
    // in the else branch below.
    const puppeteer = await import('puppeteer')
    const systemChrome = findLocalChromeExecutable()
    browser = await puppeteer.launch({
      headless: true,
      args: LOCAL_LAUNCH_ARGS,
      ...(systemChrome ? { executablePath: systemChrome } : {}),
    }) as unknown as Browser
  } else {
    // This exact invocation (raw chromium.args, headless: true, no
    // defaultArgs wrapping) is what actually generated invoices/receipts
    // successfully in production for months before the progress-note PDF
    // feature was added — reverted back to it after a documentation-based
    // "headless: 'shell'" change didn't fix progress notes and broke
    // invoices too. Don't "improve" this again without confirmed evidence
    // (real Vercel function logs) that a specific change fixes a specific
    // observed production error — not just docs/type-definition reasoning.
    const chromium = (await import('@sparticuz/chromium')).default
    const puppeteer = await import('puppeteer-core')
    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    const withHeaderFooter = !!options.displayHeaderFooter
    const baseMargin = withHeaderFooter
      // A running header/footer needs more room than the tight default
      // margin, or Chromium overlaps it with the page content.
      ? { top: '0.6in', bottom: '0.5in', left: '0.25in', right: '0.25in' }
      : { top: '0.25in', bottom: '0.25in', left: '0.25in', right: '0.25in' }
    const pdf = await page.pdf({
      format: 'letter',
      landscape: !!options.landscape,
      printBackground: true,
      margin: { ...baseMargin, ...options.margin },
      displayHeaderFooter: withHeaderFooter,
      headerTemplate: options.headerTemplate,
      footerTemplate: options.footerTemplate,
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
