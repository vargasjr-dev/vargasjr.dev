/**
 * Pushes the Drizzle schema to Neon.
 * Usage: NEON_URL=<connection_string> bun scripts/db-push.ts
 */
import { execSync } from "child_process";

if (!process.env.NEON_URL && !process.env.POSTGRES_URL) {
  console.error("Set NEON_URL or POSTGRES_URL before running this script.");
  process.exit(1);
}

execSync("bunx drizzle-kit push", { stdio: "inherit" });
