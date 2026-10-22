"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  velcroFetch,
  type VelcroCustomer,
  type VelcroActivityItem,
} from "../api";

// Activity is a thin shell for v1: manual adds only, no ingestion machinery.
// The real shape of this tab will be reworked once Vellum's Velcro source
// code is available to give us a leg up.
export default function ActivityPage() {
  const router = useRouter();
  const [items, setItems] = useState<VelcroActivityItem[]>([]);
  const [customers, setCustomers] = useState<VelcroCustomer[]>([]);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [customerId, setCustomerId] = useState("");

  const load = useCallback(async () => {
    const res = await velcroFetch(`activity${unreadOnly ? "?unread=1" : ""}`);
    if (!res) return;
    const data = await res.json();
    setItems(data.items ?? []);
    const customersRes = await velcroFetch("customers");
    if (customersRes) {
      const customersData = await customersRes.json();
      setCustomers(customersData.customers ?? []);
    }
    setLoading(false);
  }, [unreadOnly]);

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      window.location.href = "/admin";
      return;
    }
    load();
  }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError("");
    const res = await velcroFetch("activity", {
      method: "POST",
      body: JSON.stringify({
        title,
        body: body || null,
        customerId: customerId ? Number(customerId) : null,
      }),
    });
    if (!res) return;
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to add activity item.");
      setAdding(false);
      return;
    }
    setTitle("");
    setBody("");
    setCustomerId("");
    setAdding(false);
    load();
  }

  async function setRead(id: number, read: boolean) {
    const res = await velcroFetch(`activity/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ read }),
    });
    if (!res) return;
    load();
  }

  async function remove(id: number) {
    const res = await velcroFetch(`activity/${id}`, { method: "DELETE" });
    if (!res) return;
    load();
  }

  // The one crossing point between the shell and the heart: spin up a case
  // seeded from this item, then jump into it.
  async function newCaseFrom(item: VelcroActivityItem) {
    const res = await velcroFetch("cases", {
      method: "POST",
      body: JSON.stringify({
        title: item.title,
        customerId: item.customerId,
        activityItemId: item.id,
      }),
    });
    if (!res) return;
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Failed to create case from activity item.");
      return;
    }
    router.push(`/admin/velcro/cases/${data.case.id}`);
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleAdd}
        className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3"
      >
        <h2 className="font-semibold text-gray-100">Add activity manually</h2>
        {error ? <p className="text-red-400 text-sm">{error}</p> : null}
        <input
          required
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc]"
        />
        <textarea
          placeholder="Body (optional)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc]"
        />
        <div className="flex items-center gap-2">
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc] text-sm"
          >
            <option value="">No customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={adding}
            className="px-4 py-2 rounded-lg bg-[#3ba4dc] text-white font-semibold hover:bg-[#2990c5] disabled:opacity-50 text-sm"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setUnreadOnly(!unreadOnly)}
          className="text-sm text-gray-400 hover:text-gray-200"
        >
          {unreadOnly ? "Showing unread — show all" : "Show unread only"}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-gray-400 text-sm">
          No activity items{unreadOnly ? " unread" : ""}.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className={`bg-gray-900 border border-gray-800 rounded-lg p-4 ${
                item.readAt ? "opacity-70" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-100">
                    {!item.readAt ? (
                      <span className="inline-block w-2 h-2 rounded-full bg-[#3ba4dc] mr-2 align-middle" />
                    ) : null}
                    {item.title}
                  </p>
                  {item.body ? (
                    <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">
                      {item.body}
                    </p>
                  ) : null}
                  <p className="text-xs text-gray-500 mt-2">
                    {item.customerName ? `${item.customerName} · ` : ""}
                    {item.source} · {new Date(item.createdAt).toLocaleString()}
                    {item.readAt
                      ? ` · read ${new Date(item.readAt).toLocaleString()}`
                      : ""}
                  </p>
                </div>
                <div className="shrink-0 flex flex-col items-end gap-1">
                  <button
                    onClick={() => setRead(item.id, !item.readAt)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
                  >
                    {item.readAt ? "Mark as Unread" : "Mark as Read"}
                  </button>
                  <button
                    onClick={() => newCaseFrom(item)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-[#3ba4dc] hover:bg-[#2990c5] text-white"
                  >
                    New case
                  </button>
                  <button
                    onClick={() => remove(item.id)}
                    className="text-xs text-gray-500 hover:text-red-400"
                  >
                    delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-500">
        Cases live in{" "}
        <Link
          href="/admin/velcro/cases"
          className="text-[#3ba4dc] hover:underline"
        >
          the Cases tab
        </Link>
        .
      </p>
    </div>
  );
}
