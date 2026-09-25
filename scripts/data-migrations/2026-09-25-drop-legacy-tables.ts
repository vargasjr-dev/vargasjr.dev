/**
 * Drop legacy tables from the pre-Vellum (2025) vargasjr stack.
 *
 * The production Neon database was provisioned by an earlier generation of
 * the vargasjr stack. That project is gone, its code is gone, and the
 * current app owns exactly three tables (emails, gmail_connection,
 * accounting_entries). Everything else is an orphaned fossil layer:
 * inboxes, contacts, jobs, chat sessions, webauthn credentials, and two
 * supporting tables from the same era.
 *
 * Vargas reviewed the row counts and confirmed the legacy data has no
 * archival value (2026-09-25). This script:
 *   1. logs the state of every public table before touching anything;
 *   2. fails closed if any keeper table is missing or its row count is
 *      unexpected;
 *   3. drops only the legacy tables (CASCADE, in dependency-safe order);
 *   4. re-verifies that keepers still exist with unchanged row counts and
 *      that no legacy table remains.
 *
 * Rerun-safe: a second run finds no legacy tables and exits successfully.
 *
 * Credentials: `database` (DATABASE_URL = POSTGRES_URL secret).
 */

import { neon } from "@neondatabase/serverless";

const KEEP: Record<string, number | "unknown"> = {
  emails: 226,
  gmail_connection: 1,
  accounting_entries: "unknown", // may already hold the first entries
};

const LEGACY: string[] = [
  // dependents first
  "inbox_message_operations",
  "inbox_messages",
  "inboxes",
  "outbox_message_recipients",
  "outbox_messages",
  "job_sessions",
  "jobs",
  "chat_sessions",
  "routine_jobs",
  "contact_github_repos",
  "contacts",
  "applications",
  "application_workspaces",
  "webauthn_credentials",
  "blog_posts",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tableExists(sql: any, name: string): Promise<boolean> {
  const rows =
    await sql`SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ${name}`;
  return rows.length > 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function countRows(sql: any, name: string): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const queries: Record<string, Promise<any[]>> = {
    emails: sql`SELECT count(*)::int AS n FROM emails`,
    gmail_connection: sql`SELECT count(*)::int AS n FROM gmail_connection`,
    accounting_entries: sql`SELECT count(*)::int AS n FROM accounting_entries`,
    application_workspaces: sql`SELECT count(*)::int AS n FROM application_workspaces`,
    applications: sql`SELECT count(*)::int AS n FROM applications`,
    blog_posts: sql`SELECT count(*)::int AS n FROM blog_posts`,
    chat_sessions: sql`SELECT count(*)::int AS n FROM chat_sessions`,
    contact_github_repos: sql`SELECT count(*)::int AS n FROM contact_github_repos`,
    contacts: sql`SELECT count(*)::int AS n FROM contacts`,
    inbox_message_operations: sql`SELECT count(*)::int AS n FROM inbox_message_operations`,
    inbox_messages: sql`SELECT count(*)::int AS n FROM inbox_messages`,
    inboxes: sql`SELECT count(*)::int AS n FROM inboxes`,
    job_sessions: sql`SELECT count(*)::int AS n FROM job_sessions`,
    jobs: sql`SELECT count(*)::int AS n FROM jobs`,
    outbox_message_recipients: sql`SELECT count(*)::int AS n FROM outbox_message_recipients`,
    outbox_messages: sql`SELECT count(*)::int AS n FROM outbox_messages`,
    routine_jobs: sql`SELECT count(*)::int AS n FROM routine_jobs`,
    webauthn_credentials: sql`SELECT count(*)::int AS n FROM webauthn_credentials`,
  };
  const result = await queries[name]!;
  return result[0].n as number;
}

const sql = neon(process.env.DATABASE_URL!);

// ---------- BEFORE ----------
console.log("=== BEFORE ===");
const beforeKeeperCounts: Record<string, number> = {};
for (const [name, expected] of Object.entries(KEEP)) {
  if (!(await tableExists(sql, name))) {
    throw new Error(`KEEPER TABLE MISSING BEFORE RUN: ${name} — aborting`);
  }
  const n = await countRows(sql, name);
  beforeKeeperCounts[name] = n;
  // Live tables grow (new mail, new entries); only row LOSS is the danger
  // CASCADE could cause, so require count >= expected rather than exact.
  if (expected !== "unknown" && n < expected) {
    throw new Error(
      `KEEPER TABLE LOST ROWS: ${name} has ${n} rows, expected at least ${expected} — aborting`,
    );
  }
  console.log(`keeper ${name}: ${n} rows (ok)`);
}

const legacyPresent: string[] = [];
for (const name of LEGACY) {
  if (await tableExists(sql, name)) {
    legacyPresent.push(name);
    console.log(`legacy ${name}: ${await countRows(sql, name)} rows`);
  } else {
    console.log(`legacy ${name}: already absent`);
  }
}

if (legacyPresent.length === 0) {
  console.log("No legacy tables remain — nothing to do.");
  process.exit(0);
}

// ---------- DROP ----------
console.log(`=== DROPPING ${legacyPresent.length} LEGACY TABLES ===`);
for (const name of legacyPresent) {
  // The neon-http driver only accepts tagged templates or sql.query().
  // Table names are identifiers and cannot be parameterized; they come
  // exclusively from the hardcoded LEGACY list, validated below.
  if (!/^[a-z_]+$/.test(name))
    throw new Error(`unexpected table name: ${name}`);
  await sql.query(`DROP TABLE IF EXISTS "${name}" CASCADE`);
  console.log(`dropped ${name}`);
}

// ---------- AFTER ----------
console.log("=== AFTER ===");
for (const name of LEGACY) {
  if (await tableExists(sql, name)) {
    throw new Error(`LEGACY TABLE STILL PRESENT AFTER DROP: ${name} — failing`);
  }
}
console.log("all legacy tables absent");

for (const [name, before] of Object.entries(beforeKeeperCounts)) {
  if (!(await tableExists(sql, name))) {
    throw new Error(
      `KEEPER TABLE MISSING AFTER RUN: ${name} — CASCADE damaged a keeper, investigate immediately`,
    );
  }
  const n = await countRows(sql, name);
  if (n < before) {
    throw new Error(
      `KEEPER TABLE LOST ROWS: ${name} was ${before}, now ${n} — CASCADE removed rows, investigate immediately`,
    );
  }
  console.log(
    `keeper ${name}: ${before} -> ${n} rows (${n === before ? "unchanged" : "grew"} — no loss)`,
  );
}

console.log("SUCCESS: legacy tables dropped, keeper tables intact.");
