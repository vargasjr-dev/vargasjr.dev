import type { Config } from "drizzle-kit";

const databaseUrl = process.env.NEON_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  throw new Error("NEON_URL or POSTGRES_URL is not set");
}

export default {
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  // The production database is shared with tables owned by other products.
  // Scope push to the tables this app owns so drizzle-kit never prompts to
  // drop foreign tables (which aborts the CI runner non-interactively).
  tablesFilter: ["emails", "gmail_connection", "accounting_entries"],
  dbCredentials: {
    url: databaseUrl,
  },
} satisfies Config;
