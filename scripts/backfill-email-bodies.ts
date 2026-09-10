/**
 * Backfill email bodies from Resend's Receiving API.
 *
 * Emails received before the webhook started fetching content are stored
 * with metadata only. This script fills `html` and `body` for every row
 * that is missing them, using the Receiving API
 * (GET https://api.resend.com/emails/receiving/:id).
 *
 * Usage:
 *   DATABASE_URL=postgres://... RESEND_API_KEY=re_... bun scripts/backfill-email-bodies.ts
 *
 * Idempotent: skips rows that already have content, and falls back to
 * onConflictDoNothing semantics on insert.
 */

import { neon } from "@neondatabase/serverless";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const apiKey = process.env.RESEND_API_KEY;
  if (!databaseUrl || !apiKey) {
    console.error("DATABASE_URL and RESEND_API_KEY are required");
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  const rows = (await sql.query(
    "SELECT id, html, body FROM emails WHERE html IS NULL AND body IS NULL",
  )) as { id: string; html: string | null; body: string | null }[];

  console.log(`[backfill] ${rows.length} email(s) missing bodies`);

  for (const row of rows) {
    const res = await fetch(
      `https://api.resend.com/emails/receiving/${row.id}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!res.ok) {
      console.warn(
        `[backfill] skip ${row.id}: receiving fetch failed (${res.status})`,
      );
      continue;
    }
    const content = (await res.json()) as { html?: string; text?: string };
    const html = content.html ?? null;
    const body = content.text ?? null;
    const preview = (body ?? "").replace(/\s+/g, " ").trim().slice(0, 200);

    await sql.query(
      "UPDATE emails SET html = $1, body = $2, preview = $3 WHERE id = $4",
      [html, body, preview, row.id],
    );
    console.log(`[backfill] filled ${row.id} (html=${!!html}, body=${!!body})`);
  }

  console.log("[backfill] done");
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
