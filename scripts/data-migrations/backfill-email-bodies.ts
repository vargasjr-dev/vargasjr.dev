/**
 * One-time backfill: store email bodies from Resend's Receiving API.
 *
 * Emails received before the webhook started fetching content are stored
 * with metadata only. This script fills `html`, `body`, and `preview` for
 * every row that is missing them, using the Receiving API
 * (GET https://api.resend.com/emails/receiving/:id).
 *
 * Run it through .github/workflows/run-data-migration.yml with the
 * `resend` credential set. Idempotent: rows that already have content are
 * left alone, and rows whose Receiving fetch fails are skipped (and
 * reported) rather than guessed at.
 */

import { neon } from "@neondatabase/serverless";

interface EmailRow {
  id: string;
  from_address: string;
  subject: string | null;
  html: string | null;
  body: string | null;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const apiKey = process.env.RESEND_API_KEY;
  if (!databaseUrl || !apiKey) {
    console.error("DATABASE_URL and RESEND_API_KEY are required");
    process.exit(1);
  }

  const sql = neon(databaseUrl);

  // Before: select and log the intended rows.
  const rows = (await sql.query(
    `SELECT id, "from" AS from_address, subject, html, body
     FROM emails
     WHERE html IS NULL AND body IS NULL
     ORDER BY received_at ASC`,
  )) as EmailRow[];

  console.log(`[backfill] ${rows.length} email(s) missing bodies:`);
  for (const row of rows) {
    console.log(
      `[backfill]   ${row.id} from=${row.from_address} subject=${JSON.stringify(row.subject)}`,
    );
  }

  const skipped: string[] = [];

  for (const row of rows) {
    const res = await fetch(
      `https://api.resend.com/emails/receiving/${row.id}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (!res.ok) {
      console.warn(
        `[backfill] skip ${row.id}: receiving fetch failed (${res.status})`,
      );
      skipped.push(row.id);
      continue;
    }
    const content = (await res.json()) as { html?: string; text?: string };
    const html = content.html ?? null;
    const body = content.text ?? null;
    const preview = (body ?? "").replace(/\s+/g, " ").trim().slice(0, 200);

    // Update only by primary key.
    await sql.query(
      "UPDATE emails SET html = $1, body = $2, preview = $3 WHERE id = $4",
      [html, body, preview, row.id],
    );
    console.log(`[backfill] filled ${row.id} (html=${!!html}, body=${!!body})`);
  }

  // After: verify the resulting values before exiting.
  const attempted = rows.filter((row) => !skipped.includes(row.id));
  const remaining = (await sql.query(
    `SELECT id FROM emails
     WHERE html IS NULL AND body IS NULL AND id = ANY($1::uuid[])`,
    [attempted.map((row) => row.id)],
  )) as { id: string }[];

  if (remaining.length > 0) {
    console.error(
      `[backfill] verification failed: ${remaining.length} row(s) attempted but still missing bodies: ${remaining
        .map((r) => r.id)
        .join(", ")}`,
    );
    process.exit(1);
  }

  console.log(
    `[backfill] done: ${attempted.length} filled, ${skipped.length} skipped (skipped ids: ${skipped.join(", ") || "none"})`,
  );
}

main().catch((err) => {
  console.error("[backfill] fatal:", err);
  process.exit(1);
});
