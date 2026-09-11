import { pgTable, text, timestamp, varchar, index } from "drizzle-orm/pg-core";

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
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type GmailConnection = typeof gmailConnection.$inferSelect;
export type NewGmailConnection = typeof gmailConnection.$inferInsert;
