import {
  pgTable,
  text,
  timestamp,
  varchar,
  index,
  serial,
  date,
  integer,
} from "drizzle-orm/pg-core";

export const emails = pgTable(
  "emails",
  {
    id: varchar("id", { length: 128 }).primaryKey(), // Resend message ID
    to: varchar("to", { length: 256 }).notNull(), // e.g. vargas@vargasjr.dev
    from: varchar("from", { length: 256 }).notNull(),
    subject: text("subject").notNull().default(""),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    blobKey: varchar("blob_key", { length: 512 }).notNull(), // webhook payload stored in Blob
    // Full message content, fetched from Resend's Receiving API
    html: text("html"),
    body: text("body"), // plain text
    // Denormalized for quick display without blob fetch
    preview: text("preview").notNull().default(""), // first ~200 chars of plain text
  },
  (t) => [
    index("emails_to_idx").on(t.to),
    index("emails_received_at_idx").on(t.receivedAt),
  ],
);

export type Email = typeof emails.$inferSelect;
export type NewEmail = typeof emails.$inferInsert;

// Single-row table holding the OAuth connection from Vargas's Google account.
// Tokens are encrypted at rest (see lib/gmail-auth.ts).
export const gmailConnection = pgTable("gmail_connection", {
  id: varchar("id", { length: 32 }).primaryKey(), // always "google"
  email: varchar("email", { length: 256 }).notNull(), // connected Google account
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  scope: text("scope").notNull().default(""),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type GmailConnection = typeof gmailConnection.$inferSelect;
export type NewGmailConnection = typeof gmailConnection.$inferInsert;

// Append-only double-entry ledger for Vargas JR, LLC.
// Entries are never updated or deleted; corrections are new entries that
// reference the entry they correct (correctingOfId).
export const accountingEntries = pgTable(
  "accounting_entries",
  {
    id: serial("id").primaryKey(),
    entryDate: date("entry_date").notNull(),
    account: varchar("account", { length: 64 }).notNull(), // e.g. "cash", "member_contributions"
    debitCents: integer("debit_cents").notNull().default(0),
    creditCents: integer("credit_cents").notNull().default(0),
    description: text("description").notNull(),
    // Link to the source document (bank statement, transfer confirmation).
    sourceUrl: text("source_url"),
    // Stable identity of the source record (e.g. "mercury:<tx-uuid>") so
    // automated ingests are idempotent. Null for manual entries.
    externalId: varchar("external_id", { length: 128 }).unique(),
    correctingOfId: integer("correcting_of_id"), // references accountingEntries.id
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("accounting_entries_date_idx").on(t.entryDate),
    index("accounting_entries_account_idx").on(t.account),
  ],
);

export type AccountingEntry = typeof accountingEntries.$inferSelect;
export type NewAccountingEntry = typeof accountingEntries.$inferInsert;
