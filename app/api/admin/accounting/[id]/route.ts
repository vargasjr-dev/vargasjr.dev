import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accountingEntries, accountingEntryEdits } from "@/db/schema";

// PATCH /api/admin/accounting/[id] — edit an entry's description in place.
//
// The ledger's financial substance (amount, date, account, correcting links)
// is immutable: this endpoint explicitly rejects any payload that carries
// those fields. Wrong amounts/dates get a correcting entry instead. Every
// accepted description change is recorded in accounting_entry_edits before
// the row is updated, so the audit trail is the source of truth.

function isAuthorized(request: Request): boolean {
  return request.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}

const IMMUTABLE_FIELDS = [
  "entryDate",
  "account",
  "debitCents",
  "creditCents",
  "externalId",
  "correctingOfId",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const entryId = Number(id);
  if (!Number.isInteger(entryId) || entryId <= 0) {
    return NextResponse.json({ error: "Invalid entry id" }, { status: 400 });
  }

  const body = await request.json();

  const tampering = IMMUTABLE_FIELDS.filter((field) => field in body);
  if (tampering.length > 0) {
    return NextResponse.json(
      {
        error: `${tampering.join(", ")} cannot be edited — record a correcting entry instead.`,
      },
      { status: 400 },
    );
  }

  const description: unknown = body.description;
  if (
    typeof description !== "string" ||
    description.trim().length === 0 ||
    description.trim().length > 500
  ) {
    return NextResponse.json(
      { error: "description must be 1-500 characters" },
      { status: 400 },
    );
  }

  const [entry] = await db
    .select()
    .from(accountingEntries)
    .where(eq(accountingEntries.id, entryId))
    .limit(1);
  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const newDescription = description.trim();
  if (newDescription === entry.description) {
    return NextResponse.json({ entry });
  }

  // Audit row first, update second.
  await db.insert(accountingEntryEdits).values({
    entryId,
    oldDescription: entry.description,
    newDescription,
  });
  const [updated] = await db
    .update(accountingEntries)
    .set({ description: newDescription })
    .where(eq(accountingEntries.id, entryId))
    .returning();

  return NextResponse.json({ entry: updated });
}
