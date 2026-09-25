import { NextResponse } from "next/server";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { accountingEntries } from "@/db/schema";

function isAuthorized(request: Request): boolean {
  return request.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}

// GET /api/admin/accounting — list entries with per-account balances.
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const entries = await db
    .select()
    .from(accountingEntries)
    .orderBy(desc(accountingEntries.entryDate), desc(accountingEntries.id));

  const balances = await db
    .select({
      account: accountingEntries.account,
      debitCents: sql<number>`coalesce(sum(${accountingEntries.debitCents}), 0)`,
      creditCents: sql<number>`coalesce(sum(${accountingEntries.creditCents}), 0)`,
    })
    .from(accountingEntries)
    .groupBy(accountingEntries.account);

  return NextResponse.json({ entries, balances });
}

// POST /api/admin/accounting — append a new entry. No update or delete exists:
// the ledger is append-only, and corrections are new entries that reference
// the entry they correct via correctingOfId.
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const entryDate: unknown = body.entryDate;
  const account: unknown = body.account;
  const description: unknown = body.description;
  const debitCents: unknown = body.debitCents ?? 0;
  const creditCents: unknown = body.creditCents ?? 0;
  const sourceUrl: unknown = body.sourceUrl;
  const correctingOfId: unknown = body.correctingOfId;

  if (typeof entryDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
    return NextResponse.json(
      { error: "entryDate must be YYYY-MM-DD" },
      { status: 400 },
    );
  }
  if (typeof account !== "string" || !/^[a-z_]{1,64}$/.test(account)) {
    return NextResponse.json(
      { error: "account must be lowercase letters/underscores, max 64 chars" },
      { status: 400 },
    );
  }
  if (typeof description !== "string" || description.trim().length === 0) {
    return NextResponse.json(
      { error: "description is required" },
      { status: 400 },
    );
  }
  if (typeof debitCents !== "number" || typeof creditCents !== "number") {
    return NextResponse.json(
      { error: "debitCents and creditCents must be numbers" },
      { status: 400 },
    );
  }
  const exactlyOneSide =
    (debitCents > 0 && creditCents === 0) ||
    (creditCents > 0 && debitCents === 0);
  if (!exactlyOneSide) {
    return NextResponse.json(
      { error: "exactly one of debitCents or creditCents must be positive" },
      { status: 400 },
    );
  }
  if (
    sourceUrl !== undefined &&
    sourceUrl !== null &&
    typeof sourceUrl !== "string"
  ) {
    return NextResponse.json(
      { error: "sourceUrl must be a string" },
      { status: 400 },
    );
  }
  if (
    correctingOfId !== undefined &&
    correctingOfId !== null &&
    typeof correctingOfId !== "number"
  ) {
    return NextResponse.json(
      { error: "correctingOfId must be a number" },
      { status: 400 },
    );
  }

  const [entry] = await db
    .insert(accountingEntries)
    .values({
      entryDate,
      account,
      debitCents,
      creditCents,
      description: description.trim(),
      sourceUrl: (sourceUrl as string | null | undefined) ?? null,
      correctingOfId: (correctingOfId as number | null | undefined) ?? null,
    })
    .returning();

  return NextResponse.json({ entry }, { status: 201 });
}
