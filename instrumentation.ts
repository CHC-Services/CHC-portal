// Runs once on server startup (every cold start in Vercel serverless).
// Processes any claim reminders that have crossed the prompt-pay threshold
// so existing claims are caught immediately on deployment rather than
// waiting for the next midnight cron run.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { runClaimReminders } = await import('./lib/runClaimReminders')
      await runClaimReminders()
    } catch {
      // Non-fatal — the scheduled cron at midnight will catch any misses
    }
  }
}
