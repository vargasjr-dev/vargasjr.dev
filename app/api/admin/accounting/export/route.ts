import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { accountingEntries } from "@/db/schema";

// GET /api/admin/accounting/export — CSV export of the full ledger for a CPA.
export async function GET(request: Request) {
  if (request.headers.get("x-admin-token") !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await db
    .select()
    .from(accountingEntries)
    .orderBy(asc(accountingEntries.entryDate), asc(accountingEntries.id));

  const header =
    "id,entry_date,account,category,debit_cents,credit_cents,description,source_url,correcting_of_id,created_at";
  const rows = entries.map((e) =>
    [
      e.id,
      e.entryDate,
      e.account,
      e.debitCents,
      e.creditCents,
      e.category ?? "",
      e.description,
      e.sourceUrl ?? "",
      e.correctingOfId ?? "",
      e.createdAt.toISOString(),
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );

  return new NextResponse([header, ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="accounting-ledger.csv"',
    },
  });
}
