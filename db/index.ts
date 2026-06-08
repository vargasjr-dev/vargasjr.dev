import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";

const url = process.env.NEON_URL || process.env.POSTGRES_URL;
if (!url) throw new Error("NEON_URL or POSTGRES_URL is required");

const sql = neon(url);
export const db = drizzle(sql, { schema });
