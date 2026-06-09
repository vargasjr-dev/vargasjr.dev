import { neon } from "@neondatabase/serverless";

const url = process.env.POSTGRES_URL;
if (!url) throw new Error("POSTGRES_URL not set");

const sql = neon(url);
const rows = await sql`
  SELECT id, "to", "from", subject, received_at 
  FROM emails 
  ORDER BY received_at DESC 
  LIMIT 10
`;
console.log(JSON.stringify(rows, null, 2));
