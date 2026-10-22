"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { velcroFetch, type VelcroCase, type VelcroCustomer } from "../api";
import CustomerPicker from "../customer-picker";

// Priority badge coloring — fully manual, Vargas sets the number.
function priorityTone(priority: number): string {
  if (priority >= 80) return "bg-red-900/60 text-red-200";
  if (priority >= 50) return "bg-amber-900/60 text-amber-200";
  return "bg-gray-700/60 text-gray-300";
}

// Open cases: priority desc, then newest first. Closed ones sink below.
function sortOpen(a: VelcroCase, b: VelcroCase): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  return a.createdAt < b.createdAt ? 1 : -1;
}

export default function CasesPage() {
  const [cases, setCases] = useState<VelcroCase[]>([]);
  const [customers, setCustomers] = useState<VelcroCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClosed, setShowClosed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  // Create form — everything manual: priority defaults to 50, no auto logic.
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("50");
  const [customerId, setCustomerId] = useState<number | null>(null);
  const [blockedOn, setBlockedOn] = useState("");

  const load = useCallback(async () => {
    try {
      const casesRes = await velcroFetch("cases");
      if (!casesRes) return;
      const casesData = await casesRes.json();
      setCases(casesData.cases ?? []);
      const customersRes = await velcroFetch("customers");
      if (customersRes) {
        const customersData = await customersRes.json();
        setCustomers(customersData.customers ?? []);
      }
    } catch {
      // A failed fetch must never leave the spinner hanging.
      setError("Couldn't load cases — is the API up? Try again.");
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
    const res = await velcroFetch("cases", {
      method: "POST",
      body: JSON.stringify({
        title,
        priority: parseInt(priority, 10) || 0,
        customerId,
        blockedOn: blockedOn || null,
      }),
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create case.");
      setCreating(false);
      return;
    }
    setTitle("");
    setPriority("50");
    setCustomerId(null);
    setBlockedOn("");
    setCreating(false);
    load();
  }

  async function setStatus(id: number, status: string) {
    const res = await velcroFetch(`cases/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (!res) return;
    load();
  }

  const openCases = cases.filter((c) => c.status === "open").sort(sortOpen);
  const closedCases = cases.filter((c) => c.status !== "open").sort(sortOpen);

  function caseRow(c: VelcroCase, closed: boolean) {
    return (
      <div
        key={c.id}
        className={`bg-gray-900 rounded-lg p-4 border ${
          closed ? "border-gray-800 opacity-70" : "border-gray-800"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/admin/velcro/cases/${c.id}`}
              className="font-semibold text-gray-100 hover:text-[#3ba4dc]"
            >
              #{c.id} {c.title}
            </Link>
            <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
              <span
                className={`px-2 py-0.5 rounded-full font-semibold ${priorityTone(c.priority)}`}
              >
                P{c.priority}
              </span>
              {c.blockedOn ? (
                <span className="px-2 py-0.5 rounded-full bg-amber-900/40 text-amber-300">
                  Blocked: {c.blockedOn}
                </span>
              ) : null}
              {c.customerName ? (
                <span className="text-gray-400">{c.customerName}</span>
              ) : null}
              <span className="text-gray-500">
                {new Date(c.createdAt).toLocaleString()}
              </span>
              {closed && c.closedAt ? (
                <span className="text-gray-500">
                  closed {new Date(c.closedAt).toLocaleString()}
                </span>
              ) : null}
            </div>
          </div>
          <button
            onClick={() => setStatus(c.id, closed ? "open" : "closed")}
            className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
          >
            {closed ? "Reopen" : "Close"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleCreate}
        className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3"
      >
        <h2 className="font-semibold text-gray-100">New case</h2>
        {error ? <p className="text-red-400 text-sm">{error}</p> : null}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <input
            required
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="sm:col-span-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc]"
          />
          <input
            type="number"
            min={0}
            max={100}
            placeholder="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc]"
          />
          <CustomerPicker
            customers={customers}
            value={customerId}
            onChange={setCustomerId}
            onCustomersChanged={load}
          />
        </div>
        <input
          placeholder="Blocked on (what's holding it up)"
          value={blockedOn}
          onChange={(e) => setBlockedOn(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc]"
        />
        <button
          type="submit"
          disabled={creating}
          className="px-4 py-2 rounded-lg bg-[#3ba4dc] text-white font-semibold hover:bg-[#2990c5] disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create case"}
        </button>
      </form>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : (
        <div className="space-y-3">
          {openCases.length === 0 ? (
            <p className="text-gray-400 text-sm">No open cases.</p>
          ) : (
            openCases.map((c) => caseRow(c, false))
          )}
          {closedCases.length > 0 ? (
            <div className="space-y-3">
              <button
                onClick={() => setShowClosed(!showClosed)}
                className="text-sm text-gray-400 hover:text-gray-200"
              >
                {showClosed ? "Hide" : "Show"} {closedCases.length} closed
              </button>
              {showClosed ? closedCases.map((c) => caseRow(c, true)) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
