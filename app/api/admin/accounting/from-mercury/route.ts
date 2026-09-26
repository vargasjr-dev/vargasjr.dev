import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { accountingEntries } from "@/db/schema";
import {
  descriptionFor,
  mercuryFetch,
  mercuryLedgerAccount,
  transactionIdFromUrl,
  type MercuryTransaction,
} from "@/lib/mercury";

// POST /api/admin/accounting/from-mercury — parse a Mercury dashboard
// transaction link and record the ledger entry in one action.
//
// Body: { url: string } — any Mercury dashboard link that embeds the
// transaction UUID. The entry is stamped with external_id = "mercury:<txId>"
// so the daily cron ingest skips it (unique + ON CONFLICT DO NOTHING) —
// pending transactions included: once it settles on Mercury, the nightly
// run will see it already in the ledger and no-op.

function isAuthorized(request: Request): boolean {
  return request.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const url: unknown = body.url;
  if (typeof url !== "string" || url.trim().length === 0) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  const txId = transactionIdFromUrl(url);
  if (!txId) {
    return NextResponse.json(
      { error: "Could not find a Mercury transaction id in that link." },
      { status: 400 },
    );
  }

  let tx: MercuryTransaction;
  try {
    tx = await mercuryFetch<MercuryTransaction>(`/transaction/${txId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes("404") ? 404 : 502;
    return NextResponse.json(
      { error: status === 404 ? "Transaction not found on Mercury." : message },
      { status },
    );
  }

  if (
    tx.status === "cancelled" ||
    tx.status === "failed" ||
    tx.status === "blocked"
  ) {
    return NextResponse.json(
      { error: `Transaction is ${tx.status} on Mercury — nothing to record.` },
      { status: 422 },
    );
  }

  const externalId = `mercury:${tx.id}`;
  const existing = await db
    .select({ id: accountingEntries.id })
    .from(accountingEntries)
    .where(eq(accountingEntries.externalId, externalId))
    .limit(1);
  if (existing.length > 0) {
    return NextResponse.json(
      { alreadyIngested: existing[0].id },
      { status: 200 },
    );
  }

  const centsValue = Math.round(Math.abs(tx.amount) * 100);
  const [entry] = await db
    .insert(accountingEntries)
    .values({
      entryDate: (tx.postedAt ?? tx.createdAt).slice(0, 10),
      account: mercuryLedgerAccount(),
      debitCents: tx.amount > 0 ? centsValue : 0, // money in = debit to cash
      creditCents: tx.amount < 0 ? centsValue : 0, // money out = credit to cash
      description: descriptionFor(tx),
      sourceUrl: tx.dashboardLink,
      externalId,
    })
    .returning();

  return NextResponse.json(
    { entry, pending: tx.status === "pending" },
    { status: 201 },
  );
}
