import { NextResponse } from "next/server";
import { db } from "@/db";
import { accountingEntries } from "@/db/schema";

// Daily ingest of Mercury bank transactions into the accounting ledger.
//
// Scheduled via vercel.json ("crons"). Vercel's scheduler automatically
// attaches `Authorization: Bearer $CRON_SECRET` when that env var is set on
// the deployment, so authorization here accepts either the cron secret or
// the admin token (manual runs from the admin UI / curl).
//
// Required env vars:
//   MERCURY_API_KEY  — read-only Mercury API token ("secret-token:...").
//                      Created at app.mercury.com/settings/api.
//   CRON_SECRET      — shared secret Vercel sends with scheduled invocations.
// Optional:
//   MERCURY_ACCOUNT_IDS — comma-separated Mercury account ids to ingest.
//                         Defaults to every account on the organization.
//   MERCURY_LEDGER_ACCOUNT — ledger account name for the bank. Default "cash".
//
// Idempotency: every entry is stamped with externalId = "mercury:<txId>" and
// inserted with ON CONFLICT DO NOTHING, so re-runs never duplicate rows. The
// ledger stays append-only — corrections are manual entries via the UI.

const MERCURY_BASE = "https://api.mercury.com/api/v1";
const LOOKBACK_DAYS = 7; // overlap window so late-posting transactions aren't missed

type MercuryTransaction = {
  id: string;
  amount: number; // dollars; negative = money out
  status: "pending" | "sent" | "cancelled" | "failed" | "reversed" | "blocked";
  counterpartyName: string | null;
  bankDescription: string | null;
  note: string | null;
  kind: string;
  createdAt: string; // UTC datetime
  postedAt: string | null; // UTC datetime, null while pending
  dashboardLink: string;
};

type MercuryAccountsResponse = {
  accounts: { id: string; name: string }[];
  total?: number;
};

type MercuryTransactionsResponse = {
  total: number;
  transactions: MercuryTransaction[];
};

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (cronSecret && header === `Bearer ${cronSecret}`) return true;
  return request.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}

async function mercuryFetch<T>(path: string, apiKey: string): Promise<T> {
  const res = await fetch(`${MERCURY_BASE}${path}`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${apiKey}`,
    },
  });
  if (!res.ok) {
    throw new Error(
      `Mercury API ${path} failed: ${res.status} ${await res.text()}`,
    );
  }
  return res.json() as Promise<T>;
}

function descriptionFor(tx: MercuryTransaction): string {
  const primary =
    tx.counterpartyName ?? tx.bankDescription ?? tx.note ?? tx.kind;
  const secondary = tx.note && tx.note !== primary ? ` — ${tx.note}` : "";
  return `${primary}${secondary}`.slice(0, 500);
}

async function ingestAccount(
  accountId: string,
  accountName: string,
  apiKey: string,
  ledgerAccount: string,
): Promise<{ account: string; fetched: number; inserted: number }> {
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - LOOKBACK_DAYS);
  const startParam = start.toISOString().slice(0, 10);

  // Page through transactions (Mercury caps a page at 1000).
  const fetched: MercuryTransaction[] = [];
  let offset = 0;
  let total = Infinity;
  while (fetched.length < total) {
    const page = await mercuryFetch<MercuryTransactionsResponse>(
      `/account/${accountId}/transactions?limit=1000&offset=${offset}&start=${startParam}&status=sent`,
      apiKey,
    );
    total = page.total;
    fetched.push(...page.transactions);
    if (page.transactions.length === 0) break;
    offset += page.transactions.length;
  }

  // Only settled transactions hit the ledger.
  const settled = fetched.filter((tx) => tx.status === "sent");

  let inserted = 0;
  if (settled.length > 0) {
    const rows = settled.map((tx) => {
      const centsValue = Math.round(Math.abs(tx.amount) * 100);
      const entryDate = (tx.postedAt ?? tx.createdAt).slice(0, 10);
      return {
        entryDate,
        account: ledgerAccount,
        debitCents: tx.amount > 0 ? centsValue : 0, // money in = debit to cash
        creditCents: tx.amount < 0 ? centsValue : 0, // money out = credit to cash
        description: descriptionFor(tx),
        sourceUrl: tx.dashboardLink,
        externalId: `mercury:${tx.id}`,
      };
    });

    const result = await db
      .insert(accountingEntries)
      .values(rows)
      .onConflictDoNothing({ target: accountingEntries.externalId })
      .returning({ id: accountingEntries.id });
    inserted = result.length;
  }

  return { account: accountName, fetched: settled.length, inserted };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.MERCURY_API_KEY;
  if (!apiKey) {
    // Graceful no-op until the Mercury token is configured, so the daily
    // cron doesn't alarm before setup is complete.
    return NextResponse.json({
      skipped: true,
      reason: "MERCURY_API_KEY not set",
    });
  }

  const ledgerAccount = process.env.MERCURY_LEDGER_ACCOUNT || "cash";
  const accountFilter = process.env.MERCURY_ACCOUNT_IDS
    ? new Set(process.env.MERCURY_ACCOUNT_IDS.split(",").map((s) => s.trim()))
    : null;

  try {
    const accountsResponse = await mercuryFetch<MercuryAccountsResponse>(
      "/accounts",
      apiKey,
    );
    const accounts = accountsResponse.accounts.filter(
      (a) => !accountFilter || accountFilter.has(a.id),
    );

    const results = [];
    for (const account of accounts) {
      try {
        results.push(
          await ingestAccount(account.id, account.name, apiKey, ledgerAccount),
        );
      } catch (error) {
        // One bad account shouldn't block the others.
        results.push({
          account: account.name,
          fetched: 0,
          inserted: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const inserted = results.reduce((sum, r) => sum + r.inserted, 0);
    return NextResponse.json({ ok: true, inserted, results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    );
  }
}
