import type { Browser } from 'puppeteer-core'

// Renders an HTML string to a PDF buffer using headless Chromium.
// @sparticuz/chromium provides a binary compatible with Vercel's serverless
// runtime; puppeteer-core drives it without bundling a full Chromium download.
export async function generatePdfFromHtml(html: string, options: { landscape?: boolean } = {}): Promise<Buffer> {
  const isLocal = !process.env.AWS_LAMBDA_FUNCTION_NAME && !process.env.VERCEL

  let browser: Browser
  if (isLocal) {
    // Local dev — use the full `puppeteer` package's bundled Chromium
    // (devDependency only) instead of the Lambda-only @sparticuz/chromium
    // binary, which won't run outside AWS.
    const puppeteer = await import('puppeteer')
    browser = await puppeteer.launch({ headless: true }) as unknown as Browser
  } else {
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
    const pdf = await page.pdf({
      format: 'letter',
      landscape: !!options.landscape,
      printBackground: true,
      margin: { top: '0.25in', bottom: '0.25in', left: '0.25in', right: '0.25in' },
    })
    return Buffer.from(pdf)
  } finally {
    await browser.close()
  }
}
