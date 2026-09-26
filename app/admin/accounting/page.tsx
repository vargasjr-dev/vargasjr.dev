"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LEDGER_CATEGORIES } from "@/lib/ledger";

type Entry = {
  id: number;
  entryDate: string;
  account: string;
  debitCents: number;
  creditCents: number;
  description: string;
  category: string | null;
  sourceUrl: string | null;
  correctingOfId: number | null;
  editCount: number;
  lastEditedAt: string | null;
};

type Balance = { account: string; debitCents: number; creditCents: number };

function cents(c: number): string {
  return (c / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default function AccountingPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState("");

  // New-entry form
  const [entryDate, setEntryDate] = useState("");
  const [account, setAccount] = useState("cash");
  const [amount, setAmount] = useState("");
  const [side, setSide] = useState<"debit" | "credit">("debit");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"link" | "manual">("link");
  const [mercuryUrl, setMercuryUrl] = useState("");
  const [mercuryStatus, setMercuryStatus] = useState<
    "idle" | "loading" | "error"
  >("idle");
  const [mercuryNotice, setMercuryNotice] = useState("");

  // Inline description editing in the table
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  // Inline category editing in the table
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(
    null,
  );

  const load = useCallback(async () => {
    const adminToken = localStorage.getItem("admin_token") ?? "";
    const res = await fetch("/api/admin/accounting", {
      headers: { "x-admin-token": adminToken },
    });
    if (res.status === 401) {
      router.replace("/admin");
      return;
    }
    const data = await res.json();
    setEntries(data.entries ?? []);
    setBalances(data.balances ?? []);
    setLoading(false);
  }, [router]);

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      router.replace("/admin");
      return;
    }
    load();
  }, [router, load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setMessage("");

    const centsValue = Math.round(parseFloat(amount) * 100);
    if (isNaN(centsValue) || centsValue <= 0) {
      setStatus("error");
      setMessage("Amount must be a positive number.");
      return;
    }

    const adminToken = localStorage.getItem("admin_token") ?? "";
    const res = await fetch("/api/admin/accounting", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": adminToken,
      },
      body: JSON.stringify({
        entryDate,
        account,
        [side === "debit" ? "debitCents" : "creditCents"]: centsValue,
        description,
        category: category || null,
        sourceUrl: sourceUrl || null,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setStatus("error");
      setMessage(data.error ?? "Failed to add entry.");
      return;
    }

    setStatus("idle");
    setMessage(`Entry #${data.entry.id} recorded.`);
    setAmount("");
    setDescription("");
    setCategory("");
    setSourceUrl("");
    setModalOpen(false);
    setModalMode("link");
    setMercuryUrl("");
    load();
  }

  // One shot: parse the Mercury link and record the entry.
  async function handleMercuryRecord(e: React.FormEvent) {
    e.preventDefault();
    setMercuryStatus("loading");
    setMercuryNotice("");

    const adminToken = localStorage.getItem("admin_token") ?? "";
    const res = await fetch("/api/admin/accounting/from-mercury", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": adminToken,
      },
      body: JSON.stringify({ url: mercuryUrl.trim() }),
    });

    const data = await res.json();
    if (!res.ok) {
      setMercuryStatus("error");
      setMercuryNotice(data.error ?? "Failed to record from link.");
      return;
    }

    setMercuryStatus("idle");
    setMercuryUrl("");
    setModalOpen(false);
    setModalMode("link");

    if (data.alreadyIngested) {
      setMessage(
        `That transaction is already in the ledger as entry #${data.alreadyIngested}.`,
      );
    } else if (data.pending) {
      setMessage(
        `Entry #${data.entry.id} recorded from Mercury (transaction still pending). The nightly cron will not duplicate it.`,
      );
    } else {
      setMessage(`Entry #${data.entry.id} recorded from Mercury.`);
    }
    load();
  }

  function resetModal() {
    setModalOpen(false);
    setModalMode("link");
    setMercuryUrl("");
    setMercuryStatus("idle");
    setMercuryNotice("");
  }

  function startDescriptionEdit(e: Entry) {
    setEditingId(e.id);
    setEditDraft(e.description);
  }

  async function saveDescriptionEdit(entryId: number) {
    const next = editDraft.trim();
    if (next.length === 0) return;
    setEditSaving(true);

    const adminToken = localStorage.getItem("admin_token") ?? "";
    const res = await fetch(`/api/admin/accounting/${entryId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": adminToken,
      },
      body: JSON.stringify({ description: next }),
    });
    setEditSaving(false);

    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed to update description.");
      return;
    }
    setEditingId(null);
    setEditDraft("");
    load();
  }

  // Categories save immediately on pick — they're metadata, not substance.
  async function saveCategoryEdit(entryId: number, next: string) {
    setEditingCategoryId(null);

    const adminToken = localStorage.getItem("admin_token") ?? "";
    const res = await fetch(`/api/admin/accounting/${entryId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-admin-token": adminToken,
      },
      body: JSON.stringify({ category: next || null }),
    });

    const data = await res.json();
    if (!res.ok) {
      setMessage(data.error ?? "Failed to update category.");
      return;
    }
    load();
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">Loading ledger…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-[#3ba4dc]">
            ⚖️ Accounting Ledger
          </h1>
          <div className="flex items-center gap-2">
            <a
              href="/api/admin/accounting/export"
              title="Export CSV"
              aria-label="Export CSV"
              className="p-2 rounded-lg bg-gray-900 text-gray-400 hover:text-gray-200 hover:bg-gray-800 transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </a>
            <button
              onClick={() => setModalOpen(true)}
              className="py-2 px-3 rounded-lg bg-[#3ba4dc] text-white font-semibold hover:bg-[#2990c5] transition-colors text-sm"
            >
              Record entry
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {balances.map((b) => (
            <div key={b.account} className="bg-gray-900 rounded-lg p-4">
              <p className="text-gray-400 text-xs mb-1">
                {b.account.replace(/_/g, " ")}
              </p>
              <p className="text-white font-semibold">
                {cents(b.debitCents - b.creditCents)}
              </p>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-gray-800">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Account</th>
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4 text-right">Debit</th>
                <th className="py-2 pr-4 text-right">Credit</th>
                <th className="py-2 pr-4">Description</th>
                <th className="py-2">Source</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} className="border-b border-gray-900">
                  <td className="py-2 pr-4 text-gray-300 whitespace-nowrap">
                    {e.entryDate}
                  </td>
                  <td className="py-2 pr-4 text-gray-400">
                    {e.account.replace(/_/g, " ")}
                  </td>
                  <td className="py-2 pr-4 text-gray-400">
                    {editingCategoryId === e.id ? (
                      <select
                        autoFocus
                        defaultValue={e.category ?? ""}
                        onChange={(ev) =>
                          saveCategoryEdit(e.id, ev.target.value)
                        }
                        onBlur={() => setEditingCategoryId(null)}
                        className="bg-gray-800 text-white rounded px-2 py-1 text-sm"
                      >
                        <option value="">—</option>
                        {LEDGER_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingCategoryId(e.id)}
                        title="Change category"
                        className="text-left hover:text-gray-200"
                      >
                        {e.category ? (
                          e.category.replace(/_/g, " ")
                        ) : (
                          <span className="text-gray-600">set category</span>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">
                    {e.debitCents ? cents(e.debitCents) : ""}
                  </td>
                  <td className="py-2 pr-4 text-right text-gray-300">
                    {e.creditCents ? cents(e.creditCents) : ""}
                  </td>
                  <td className="py-2 pr-4 text-gray-300">
                    {editingId === e.id ? (
                      <span className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={editDraft}
                          onChange={(ev) => setEditDraft(ev.target.value)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Escape") {
                              setEditingId(null);
                              setEditDraft("");
                            }
                          }}
                          maxLength={500}
                          className="bg-gray-800 text-white rounded px-2 py-1 text-sm flex-1 min-w-[12rem]"
                        />
                        <button
                          onClick={() => saveDescriptionEdit(e.id)}
                          disabled={editSaving}
                          className="text-[#3ba4dc] hover:underline text-xs whitespace-nowrap"
                        >
                          {editSaving ? "Saving…" : "Save"}
                        </button>
                        <button
                          onClick={() => {
                            setEditingId(null);
                            setEditDraft("");
                          }}
                          className="text-gray-500 hover:text-gray-300 text-xs"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <span className="group/desc inline-flex items-center gap-2">
                        <span>
                          {e.description}
                          {e.correctingOfId && (
                            <span className="text-gray-500">
                              {" "}
                              (corr. #{e.correctingOfId})
                            </span>
                          )}
                          {e.editCount > 0 && (
                            <span
                              className="text-gray-500 text-xs"
                              title={`Edited ${e.editCount} time${e.editCount > 1 ? "s" : ""}${
                                e.lastEditedAt
                                  ? ` — last ${new Date(e.lastEditedAt).toLocaleString()}`
                                  : ""
                              }`}
                            >
                              {" "}
                              (edited)
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => startDescriptionEdit(e)}
                          title="Edit description"
                          aria-label={`Edit description of entry #${e.id}`}
                          className="opacity-0 group-hover/desc:opacity-100 transition-opacity text-gray-500 hover:text-gray-300"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                          </svg>
                        </button>
                      </span>
                    )}
                  </td>
                  <td className="py-2">
                    {e.sourceUrl && (
                      <a
                        href={e.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#3ba4dc] hover:underline"
                      >
                        doc
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-gray-900 rounded-lg p-6 w-full max-w-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Record entry</h2>
              <button
                onClick={resetModal}
                aria-label="Close"
                className="text-gray-400 hover:text-gray-200"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex gap-1 mb-4 bg-gray-950 rounded-lg p-1 w-fit">
              <button
                onClick={() => {
                  setModalMode("link");
                  setStatus("idle");
                  setMessage("");
                }}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  modalMode === "link"
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Paste Mercury link
              </button>
              <button
                onClick={() => {
                  setModalMode("manual");
                  setMercuryStatus("idle");
                  setMercuryNotice("");
                }}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  modalMode === "manual"
                    ? "bg-gray-700 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                Enter manually
              </button>
            </div>

            {modalMode === "link" && (
              <form onSubmit={handleMercuryRecord} className="space-y-3">
                <input
                  type="url"
                  placeholder="https://app.mercury.com/transactions/…"
                  required
                  value={mercuryUrl}
                  onChange={(e) => setMercuryUrl(e.target.value)}
                  className="bg-gray-800 text-white rounded px-3 py-2 text-sm w-full"
                />
                <button
                  type="submit"
                  disabled={mercuryStatus === "loading"}
                  className="py-2 rounded-lg bg-[#3ba4dc] text-white font-semibold hover:bg-[#2990c5] transition-colors disabled:opacity-50 text-sm w-full"
                >
                  {mercuryStatus === "loading"
                    ? "Recording…"
                    : "Record entry from Mercury"}
                </button>
                {mercuryNotice && (
                  <p className="text-xs text-red-400">{mercuryNotice}</p>
                )}
                <p className="text-xs text-gray-500">
                  Fetches the transaction from Mercury and records it
                  immediately. Amounts, dates, and accounts are immutable once
                  recorded — descriptions can be edited in the table below.
                </p>
              </form>
            )}

            {modalMode === "manual" && (
              <form
                onSubmit={handleSubmit}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3"
              >
                <input
                  type="date"
                  required
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="bg-gray-800 text-white rounded px-3 py-2 text-sm"
                />
                <input
                  placeholder="account (e.g. cash, member_contributions)"
                  required
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  className="bg-gray-800 text-white rounded px-3 py-2 text-sm"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-gray-800 text-white rounded px-3 py-2 text-sm"
                >
                  <option value="">category (optional)</option>
                  {LEDGER_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <select
                    value={side}
                    onChange={(e) =>
                      setSide(e.target.value as "debit" | "credit")
                    }
                    className="bg-gray-800 text-white rounded px-3 py-2 text-sm"
                  >
                    <option value="debit">Debit</option>
                    <option value="credit">Credit</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder="amount"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-gray-800 text-white rounded px-3 py-2 text-sm flex-1"
                  />
                </div>
                <input
                  placeholder="source document URL (bank statement, receipt)"
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="bg-gray-800 text-white rounded px-3 py-2 text-sm"
                />
                <input
                  placeholder="description"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-gray-800 text-white rounded px-3 py-2 text-sm sm:col-span-2"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="sm:col-span-2 py-2 rounded-lg bg-[#3ba4dc] text-white font-semibold hover:bg-[#2990c5] transition-colors disabled:opacity-50 text-sm"
                >
                  {status === "loading" ? "Recording…" : "Record entry"}
                </button>
                {message && (
                  <p
                    className={`sm:col-span-2 text-xs ${
                      status === "error" ? "text-red-400" : "text-gray-400"
                    }`}
                  >
                    {message}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
