import { pgTable, text, timestamp, varchar, index } from "drizzle-orm/pg-core";

export const emails = pgTable(
  "emails",
  {
    id: varchar("id", { length: 128 }).primaryKey(), // Resend message ID
    to: varchar("to", { length: 256 }).notNull(), // e.g. vargas@vargasjr.dev
    from: varchar("from", { length: 256 }).notNull(),
    subject: text("subject").notNull().default(""),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    blobKey: varchar("blob_key", { length: 512 }).notNull(), // full body stored in Blob
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
