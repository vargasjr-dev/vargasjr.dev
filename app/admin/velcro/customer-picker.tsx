"use client";

import { useMemo, useRef, useState } from "react";
import { velcroFetch, type VelcroCustomer } from "./api";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Search-first customer selector: type a name or any connected-account
// handle (email, github, ...) to find the person. If nothing matches and
// the query is an email address, offer to create a new customer on the
// spot — the email becomes that customer's email account.
export default function CustomerPicker({
  customers,
  value,
  onChange,
  onCustomersChanged,
}: {
  customers: VelcroCustomer[];
  value: number | null;
  onChange: (customerId: number | null) => void;
  onCustomersChanged: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = customers.find((c) => c.id === value) ?? null;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.accounts.some((a) => a.handle.toLowerCase().includes(q)),
      )
      .slice(0, 6);
  }, [customers, query]);

  const queryIsEmail = EMAIL_RE.test(query.trim());
  // No exact-duplicate emails: a taken email means the person already
  // exists — the search above just didn't surface them.
  const emailAlreadyUsed = customers.some((c) =>
    c.accounts.some(
      (a) =>
        a.channel === "email" &&
        a.handle.toLowerCase() === query.trim().toLowerCase(),
    ),
  );
  const canCreate = queryIsEmail && matches.length === 0 && !emailAlreadyUsed;

  function select(id: number | null) {
    setQuery("");
    setOpen(false);
    onChange(id);
  }

  async function createFromEmail() {
    const email = query.trim();
    setCreating(true);
    setError("");
    const res = await velcroFetch("customers", {
      method: "POST",
      body: JSON.stringify({ name: email }),
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create customer.");
      setCreating(false);
      return;
    }
    // The typed email address is its own customer account on the new person.
    const accountRes = await velcroFetch("accounts", {
      method: "POST",
      body: JSON.stringify({
        customerId: data.customer.id,
        channel: "email",
        handle: email,
      }),
    });
    if (!accountRes) return;
    if (!accountRes.ok) {
      const accountData = await accountRes.json();
      setError(accountData.error ?? "Failed to attach the email account.");
      setCreating(false);
      return;
    }
    setCreating(false);
    select(data.customer.id);
    onCustomersChanged();
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder={
            selected
              ? selected.name
              : "Search customer by name or email/handle…"
          }
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            blurTimer.current = setTimeout(() => setOpen(false), 150);
          }}
          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc]"
        />
        {selected ? (
          <button
            type="button"
            onClick={() => select(null)}
            className="shrink-0 text-xs text-gray-500 hover:text-red-400"
          >
            clear
          </button>
        ) : null}
      </div>

      {open && query.trim() ? (
        <div className="absolute z-10 mt-1 w-full bg-gray-900 border border-gray-700 rounded-lg overflow-hidden shadow-lg">
          {matches.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                select(c.id);
              }}
              className="block w-full text-left px-3 py-2 text-sm text-gray-200 hover:bg-gray-800"
            >
              {c.name}
              <span className="text-gray-500">
                {c.accounts.length > 0
                  ? ` — ${c.accounts.map((a) => `${a.channel}:${a.handle}`).join(", ")}`
                  : " — no accounts yet"}
              </span>
            </button>
          ))}
          {canCreate ? (
            <button
              type="button"
              onMouseDown={() => {
                if (blurTimer.current) clearTimeout(blurTimer.current);
                createFromEmail();
              }}
              disabled={creating}
              className="block w-full text-left px-3 py-2 text-sm text-[#3ba4dc] hover:bg-gray-800 disabled:opacity-50"
            >
              {creating
                ? "Creating…"
                : `No match — create customer for ${query.trim()} (with email account)`}
            </button>
          ) : null}
          {matches.length === 0 && !canCreate ? (
            <p className="px-3 py-2 text-sm text-gray-500">
              {emailAlreadyUsed
                ? "That email is already a customer account — search by it above."
                : "No customers match. Type an email address to create one."}
            </p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-red-400 text-sm mt-1">{error}</p> : null}
    </div>
  );
}
