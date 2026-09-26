import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accountingEntries, accountingEntryEdits } from "@/db/schema";
import { isLedgerCategory } from "@/lib/ledger";

// PATCH /api/admin/accounting/[id] — edit an entry's description and/or
// category in place.
//
// The ledger's financial substance (amount, date, account, correcting links)
// is immutable: this endpoint explicitly rejects any payload that carries
// those fields. Wrong amounts/dates get a correcting entry instead. Every
// accepted change is recorded in accounting_entry_edits before the row is
// updated, so the audit trail is the source of truth.

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

  // Both fields optional; at least one must be present.
  let nextDescription: string | undefined;
  if ("description" in body) {
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
    nextDescription = description.trim();
  }

  let nextCategory: string | null | undefined;
  if ("category" in body) {
    const category: unknown = body.category;
    if (category !== null && !isLedgerCategory(category)) {
      return NextResponse.json(
        { error: "category must be one of the ledger categories" },
        { status: 400 },
      );
    }
    nextCategory = (category as string | null) ?? null;
  }

  if (nextDescription === undefined && nextCategory === undefined) {
    return NextResponse.json(
      { error: "nothing to update — send description and/or category" },
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

  const descriptionChanged =
    nextDescription !== undefined && nextDescription !== entry.description;
  const categoryChanged =
    nextCategory !== undefined && nextCategory !== entry.category;

  if (!descriptionChanged && !categoryChanged) {
    return NextResponse.json({ entry });
  }

  // Audit row first, update second. One row per action even if both fields
  // changed together — old/new pairs are null when that field didn't change.
  await db.insert(accountingEntryEdits).values({
    entryId,
    oldDescription: descriptionChanged ? entry.description : null,
    newDescription: descriptionChanged ? nextDescription! : null,
    oldCategory: categoryChanged ? entry.category : null,
    newCategory: categoryChanged ? nextCategory! : null,
  });

  const [updated] = await db
    .update(accountingEntries)
    .set({
      ...(descriptionChanged ? { description: nextDescription! } : {}),
      ...(categoryChanged ? { category: nextCategory! } : {}),
    })
    .where(eq(accountingEntries.id, entryId))
    .returning();

  return NextResponse.json({ entry: updated });
}
