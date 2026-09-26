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

// POST /api/admin/accounting/parse — turn a Mercury dashboard transaction
// link into a pre-filled ledger entry draft for the manual-entry modal.
//
// Body: { url: string } — any Mercury dashboard link that embeds the
// transaction UUID. Returns the draft plus a warning if the transaction is
// still pending or was already ingested (so we never double-count).

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
      { error: `Transaction is ${tx.status} — nothing to record.` },
      { status: 422 },
    );
  }

  const externalId = `mercury:${tx.id}`;
  const existing = await db
    .select({ id: accountingEntries.id })
    .from(accountingEntries)
    .where(eq(accountingEntries.externalId, externalId))
    .limit(1);

  const centsValue = Math.round(Math.abs(tx.amount) * 100);
  return NextResponse.json({
    draft: {
      entryDate: (tx.postedAt ?? tx.createdAt).slice(0, 10),
      account: mercuryLedgerAccount(),
      side: tx.amount > 0 ? ("debit" as const) : ("credit" as const),
      amount: (centsValue / 100).toFixed(2),
      description: descriptionFor(tx),
      sourceUrl: tx.dashboardLink,
      externalId,
    },
    // Not blockers — surfaced so the operator can decide.
    warnings: {
      pending:
        tx.status === "pending"
          ? "Transaction is still pending on Mercury."
          : null,
      alreadyIngested:
        existing.length > 0
          ? `Already in the ledger as entry #${existing[0].id}.`
          : null,
    },
  });
}
