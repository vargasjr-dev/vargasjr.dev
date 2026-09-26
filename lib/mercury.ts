// Shared Mercury banking API helpers.
// Auth: Bearer token — read-only is sufficient for everything we do here.
// Env: MERCURY_API_KEY (required), MERCURY_LEDGER_ACCOUNT (optional).

const MERCURY_BASE = "https://api.mercury.com/api/v1";

export type MercuryTransactionStatus =
  | "pending"
  | "sent"
  | "cancelled"
  | "failed"
  | "reversed"
  | "blocked";

export type MercuryTransaction = {
  id: string;
  amount: number; // dollars; negative = money out
  status: MercuryTransactionStatus;
  counterpartyName: string | null;
  bankDescription: string | null;
  note: string | null;
  kind: string;
  mercuryCategory: string | null;
  createdAt: string; // UTC datetime
  postedAt: string | null; // UTC datetime, null while pending
  dashboardLink: string;
};

export type MercuryAccount = { id: string; name: string };

export async function mercuryFetch<T>(path: string): Promise<T> {
  const apiKey = process.env.MERCURY_API_KEY;
  if (!apiKey) {
    throw new MercuryConfigError("MERCURY_API_KEY not set");
  }
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

export class MercuryConfigError extends Error {}

export function mercuryLedgerAccount(): string {
  return process.env.MERCURY_LEDGER_ACCOUNT || "cash";
}

// Human-readable ledger description for a transaction.
export function descriptionFor(tx: MercuryTransaction): string {
  const primary =
    tx.counterpartyName ?? tx.bankDescription ?? tx.note ?? tx.kind;
  const secondary = tx.note && tx.note !== primary ? ` — ${tx.note}` : "";
  return `${primary}${secondary}`.slice(0, 500);
}

// Mercury dashboard links embed the transaction UUID. Returns it if present.
export function transactionIdFromUrl(url: string): string | null {
  const match = url.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  );
  return match ? match[0] : null;
}
