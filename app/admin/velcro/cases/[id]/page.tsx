"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  velcroFetch,
  type VelcroCase,
  type VelcroCaseEvent,
  type VelcroCaseLink,
  type VelcroCustomer,
} from "../../api";

type CaseDetail = {
  case: VelcroCase;
  events: VelcroCaseEvent[];
  links: VelcroCaseLink[];
};

// Priority badge coloring — manual 0-100, set by hand.
function priorityTone(priority: number): string {
  if (priority >= 80) return "bg-red-900/60 text-red-200";
  if (priority >= 50) return "bg-amber-900/60 text-amber-200";
  return "bg-gray-700/60 text-gray-300";
}

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const caseId = params.id;

  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [customers, setCustomers] = useState<VelcroCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState("");

  // Editable fields, applied on save.
  const [priority, setPriority] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [blockedOn, setBlockedOn] = useState("");
  const [saving, setSaving] = useState(false);

  // New event (note / action).
  const [eventBody, setEventBody] = useState("");
  const [eventKind, setEventKind] = useState("note");
  const [posting, setPosting] = useState(false);

  // New link.
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");

  const load = useCallback(async () => {
    const res = await velcroFetch(`cases/${caseId}`);
    if (!res) return;
    if (res.status === 404) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const data = await res.json();
    setDetail(data);
    setPriority(String(data.case.priority));
    setCustomerId(data.case.customerId ? String(data.case.customerId) : "");
    setBlockedOn(data.case.blockedOn ?? "");
    const customersRes = await velcroFetch("customers");
    if (customersRes) {
      const customersData = await customersRes.json();
      setCustomers(customersData.customers ?? []);
    }
    setLoading(false);
  }, [caseId]);

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      window.location.href = "/admin";
      return;
    }
    load();
  }, [load]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await velcroFetch(`cases/${caseId}`, {
      method: "PATCH",
      body: JSON.stringify({
        priority: parseInt(priority, 10) || 0,
        customerId: customerId ? Number(customerId) : null,
        blockedOn: blockedOn || null,
      }),
    });
    if (!res) return;
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to save.");
      setSaving(false);
      return;
    }
    setSaving(false);
    load();
  }

  async function setStatus(status: string) {
    const res = await velcroFetch(`cases/${caseId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (!res) return;
    load();
  }

  async function addEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!eventBody.trim()) return;
    setPosting(true);
    setError("");
    const res = await velcroFetch(`cases/${caseId}/events`, {
      method: "POST",
      body: JSON.stringify({ kind: eventKind, body: eventBody }),
    });
    if (!res) return;
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to add event.");
      setPosting(false);
      return;
    }
    setEventBody("");
    setEventKind("note");
    setPosting(false);
    load();
  }

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    setError("");
    const res = await velcroFetch(`cases/${caseId}/links`, {
      method: "POST",
      body: JSON.stringify({
        url: linkUrl,
        label: linkLabel || null,
      }),
    });
    if (!res) return;
    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to add link.");
      return;
    }
    setLinkUrl("");
    setLinkLabel("");
    load();
  }

  async function removeLink(linkId: number) {
    const res = await velcroFetch(`cases/${caseId}/links?linkId=${linkId}`, {
      method: "DELETE",
    });
    if (!res) return;
    load();
  }

  if (notFound) {
    return (
      <div className="text-gray-400">
        Case not found.{" "}
        <Link href="/admin/velcro/cases" className="text-[#3ba4dc]">
          ← All cases
        </Link>
      </div>
    );
  }

  if (loading || !detail) {
    return <p className="text-gray-400">Loading…</p>;
  }

  const c = detail.case;
  const closed = c.status !== "open";

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-gray-100">
            #{c.id} {c.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
            <span
              className={`px-2 py-0.5 rounded-full font-semibold ${priorityTone(c.priority)}`}
            >
              P{c.priority}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full font-semibold ${
                closed
                  ? "bg-gray-700/60 text-gray-300"
                  : "bg-emerald-900/60 text-emerald-200"
              }`}
            >
              {closed ? "Closed" : "Open"}
            </span>
            {c.customerName ? (
              <Link
                href="/admin/velcro/customers"
                className="text-[#3ba4dc] hover:underline"
              >
                {c.customerName}
              </Link>
            ) : null}
            <span className="text-gray-500">
              created {new Date(c.createdAt).toLocaleString()}
            </span>
            {closed && c.closedAt ? (
              <span className="text-gray-500">
                closed {new Date(c.closedAt).toLocaleString()}
              </span>
            ) : null}
          </div>
        </div>
        <button
          onClick={() => setStatus(closed ? "open" : "closed")}
          className="shrink-0 text-xs px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300"
        >
          {closed ? "Reopen" : "Close case"}
        </button>
      </div>

      {error ? <p className="text-red-400 text-sm">{error}</p> : null}

      <form
        onSubmit={handleSave}
        className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3"
      >
        <h3 className="font-semibold text-sm text-gray-100">Edit case</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Priority (0-100)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc]"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Customer</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc]"
            >
              <option value="">No customer</option>
              {customers.map((cu) => (
                <option key={cu.id} value={cu.id}>
                  {cu.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              Blocked on
            </label>
            <input
              placeholder="What's holding this up?"
              value={blockedOn}
              onChange={(e) => setBlockedOn(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc]"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2 rounded-lg bg-[#3ba4dc] text-white font-semibold hover:bg-[#2990c5] disabled:opacity-50 text-sm"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-100">
          History ({detail.events.length})
        </h3>
        {detail.events.length === 0 ? (
          <p className="text-gray-400 text-sm">No history yet.</p>
        ) : (
          <div className="space-y-2">
            {detail.events.map((ev) => (
              <div key={ev.id} className="flex gap-3 items-start">
                <span
                  className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-semibold ${
                    ev.kind === "action"
                      ? "bg-[#3ba4dc]/20 text-[#3ba4dc]"
                      : "bg-gray-700/60 text-gray-300"
                  }`}
                >
                  {ev.kind}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-200 whitespace-pre-wrap">
                    {ev.body}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(ev.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        <form
          onSubmit={addEvent}
          className="space-y-2 pt-2 border-t border-gray-800"
        >
          <textarea
            placeholder="Add a note or action…"
            value={eventBody}
            onChange={(e) => setEventBody(e.target.value)}
            rows={2}
            className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc]"
          />
          <div className="flex items-center gap-2">
            <select
              value={eventKind}
              onChange={(e) => setEventKind(e.target.value)}
              className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc] text-sm"
            >
              <option value="note">note</option>
              <option value="action">action</option>
            </select>
            <button
              type="submit"
              disabled={posting}
              className="px-4 py-2 rounded-lg bg-[#3ba4dc] text-white font-semibold hover:bg-[#2990c5] disabled:opacity-50 text-sm"
            >
              {posting ? "Adding…" : "Add"}
            </button>
          </div>
        </form>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
        <h3 className="font-semibold text-sm text-gray-100">
          Links ({detail.links.length})
        </h3>
        {detail.links.length === 0 ? (
          <p className="text-gray-400 text-sm">No links attached.</p>
        ) : (
          <div className="space-y-2">
            {detail.links.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between gap-3"
              >
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#3ba4dc] hover:underline text-sm truncate"
                >
                  {link.label ?? link.url}
                </a>
                <button
                  onClick={() => removeLink(link.id)}
                  className="shrink-0 text-xs text-gray-500 hover:text-red-400"
                >
                  remove
                </button>
              </div>
            ))}
          </div>
        )}
        <form
          onSubmit={addLink}
          className="flex flex-wrap gap-2 pt-2 border-t border-gray-800"
        >
          <input
            required
            placeholder="https://…"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            className="flex-1 min-w-[12rem] px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc]"
          />
          <input
            placeholder="Label"
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
            className="w-40 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 focus:outline-none focus:border-[#3ba4dc]"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-gray-800 text-gray-200 font-semibold hover:bg-gray-700 text-sm"
          >
            Add link
          </button>
        </form>
      </div>
    </div>
  );
}
