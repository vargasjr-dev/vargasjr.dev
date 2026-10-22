"use client";

import { useCallback, useEffect, useState } from "react";
import { velcroFetch, type VelcroCustomer } from "../api";

// Customers are PEOPLE for now (aggressively human-centric — companies may
// come later). Each customer's touchpoints across channels (email, sms,
// github, ...) hang off them as accounts.
export default function CustomersPage() {
  const [customers, setCustomers] = useState<VelcroCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create form
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);

  // Per-customer inline edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Add-account form per customer
  const [accountChannel, setAccountChannel] = useState("");
  const [accountHandle, setAccountHandle] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await velcroFetch("customers");
      if (!res) return;
      const data = await res.json();
      setCustomers(data.customers ?? []);
    } catch {
      // A failed fetch must never leave the spinner hanging.
      setError("Couldn't load customers — is the API up? Try again.");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      window.location.href = "/admin";
      return;
    }
    load();
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError("");
    const res = await velcroFetch("customers", {
      method: "POST",
      body: JSON.stringify({ name, notes: notes || null }),
    });
    if (!res) return;
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to create customer.");
      setCreating(false);
      return;
    }
    setName("");
    setNotes("");
    setCreating(false);
    load();
  }

  async function handleUpdate(e: React.FormEvent, id: number) {
    e.preventDefault();
    setError("");
    const res = await velcroFetch(`customers/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name: editName, notes: editNotes || null }),
    });
    if (!res) return;
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to update customer.");
      return;
    }
    setEditingId(null);
    load();
  }

  async function handleDelete(id: number) {
    const res = await velcroFetch(`customers/${id}`, { method: "DELETE" });
    if (!res) return;
    load();
  }

  async function addAccount(e: React.FormEvent, customerId: number) {
    e.preventDefault();
    setError("");
    const res = await velcroFetch("accounts", {
      method: "POST",
      body: JSON.stringify({
        customerId,
        channel: accountChannel,
        handle: accountHandle,
      }),
    });
    if (!res) return;
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to add account.");
      return;
    }
    setAccountChannel("");
    setAccountHandle("");
    load();
  }

  async function removeAccount(accountId: number) {
    const res = await velcroFetch(`accounts/${accountId}`, {
      method: "DELETE",
    });
    if (!res) return;
    load();
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3"
      >
        <h2 className="font-semibold text-gray-100">New customer</h2>
        {error ? <p className="text-red-400 text-sm">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
          <input
            required
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 min-w-[10rem] px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc]"
          />
          <input
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="flex-1 min-w-[10rem] px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc]"
          />
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 rounded-lg bg-[#3ba4dc] text-white font-semibold hover:bg-[#2990c5] disabled:opacity-50 text-sm"
          >
            {creating ? "Creating…" : "Add customer"}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : customers.length === 0 ? (
        <p className="text-gray-400 text-sm">No customers yet.</p>
      ) : (
        <div className="space-y-3">
          {customers.map((customer) => (
            <div
              key={customer.id}
              className="bg-gray-900 border border-gray-800 rounded-lg p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-100">{customer.name}</p>
                  {customer.notes ? (
                    <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">
                      {customer.notes}
                    </p>
                  ) : null}
                  {customer.accounts.length > 0 ? (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {customer.accounts.map((account) => (
                        <span
                          key={account.id}
                          className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-300"
                        >
                          {account.channel}: {account.handle}
                          <button
                            onClick={() => removeAccount(account.id)}
                            className="ml-2 text-gray-500 hover:text-red-400"
                            aria-label={`Remove ${account.channel} account`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <button
                    onClick={() => {
                      if (editingId === customer.id) {
                        setEditingId(null);
                      } else {
                        setEditingId(customer.id);
                        setEditName(customer.name);
                        setEditNotes(customer.notes ?? "");
                      }
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
                  >
                    {editingId === customer.id ? "Cancel" : "Edit"}
                  </button>
                  <button
                    onClick={() => handleDelete(customer.id)}
                    className="text-xs text-gray-500 hover:text-red-400"
                  >
                    delete
                  </button>
                </div>
              </div>

              {editingId === customer.id ? (
                <form
                  onSubmit={(e) => handleUpdate(e, customer.id)}
                  className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap gap-2"
                >
                  <input
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 min-w-[8rem] px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc] text-sm"
                  />
                  <input
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="Notes"
                    className="flex-1 min-w-[8rem] px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc] text-sm"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#3ba4dc] text-white font-semibold hover:bg-[#2990c5] text-sm"
                  >
                    Save
                  </button>
                </form>
              ) : null}

              <form
                onSubmit={(e) => addAccount(e, customer.id)}
                className="mt-3 pt-3 border-t border-gray-800 flex flex-wrap gap-2 items-center"
              >
                <input
                  required
                  list="velcro-channels"
                  placeholder="Channel (email, sms, github…)"
                  value={accountChannel}
                  onChange={(e) => setAccountChannel(e.target.value)}
                  className="w-44 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc] text-sm"
                />
                <datalist id="velcro-channels">
                  <option value="email" />
                  <option value="sms" />
                  <option value="phone" />
                  <option value="github" />
                  <option value="slack" />
                  <option value="discord" />
                  <option value="x" />
                  <option value="telegram" />
                </datalist>
                <input
                  required
                  placeholder="Handle (address, username…)"
                  value={accountHandle}
                  onChange={(e) => setAccountHandle(e.target.value)}
                  className="flex-1 min-w-[8rem] px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc] text-sm"
                />
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-gray-800 text-gray-200 font-semibold hover:bg-gray-700 text-sm"
                >
                  Add account
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
