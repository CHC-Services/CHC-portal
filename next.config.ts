import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @sparticuz/chromium ships its Chromium binary as files bundled alongside
  // the package and resolves them at runtime relative to its own package
  // directory (lib/generateInvoicePdf.ts, lib/progressNotePdf.ts). Next.js's
  // default webpack bundling/file-tracing for serverless functions doesn't
  // preserve that — it can silently produce a function that can't find or
  // launch the Chromium binary in production even though everything works
  // locally (locally, these packages run straight from node_modules with no
  // bundling step at all). Marking both packages external skips bundling
  // them and just requires them from node_modules at runtime instead, which
  // is what lets @sparticuz/chromium's own file resolution work correctly.
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
};

export default nextConfig;
