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
    // Tax-reporting category (Schedule C lines for Vargas JR, LLC). Metadata,
    // not financial substance — reassignable, changes audited in
    // accounting_entry_edits. See lib/ledger.ts for the taxonomy.
    category: varchar("category", { length: 64 }),
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

// Audit trail for edits on ledger entries. Financial fields
// (amount, date, account) are immutable — only descriptions and categories
// may be corrected in place, and every change is recorded here first.
export const accountingEntryEdits = pgTable(
  "accounting_entry_edits",
  {
    id: serial("id").primaryKey(),
    entryId: integer("entry_id")
      .notNull()
      .references(() => accountingEntries.id, { onDelete: "cascade" }),
    oldDescription: text("old_description"),
    newDescription: text("new_description"),
    oldCategory: varchar("old_category", { length: 64 }),
    newCategory: varchar("new_category", { length: 64 }),
    editedAt: timestamp("edited_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("accounting_entry_edits_entry_idx").on(t.entryId)],
);

export type AccountingEntryEdit = typeof accountingEntryEdits.$inferSelect;
export type NewAccountingEntryEdit = typeof accountingEntryEdits.$inferInsert;
