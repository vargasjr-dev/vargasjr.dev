"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

type GmailFilter = {
  id: string;
  criteria: { from?: string; subject?: string; query?: string };
  action: { forwardTo?: string; addLabelIds?: string[]; removeLabelIds?: string[] };
};

type ForwardingAddress = {
  forwardingEmail: string;
  verificationStatus: string;
};

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${localStorage.getItem("admin_token") ?? ""}` };
}

export default function GmailAdminPage() {
  const [authed, setAuthed] = useState(false);
  const [status, setStatus] = useState<{ connected: boolean; email: string | null } | null>(null);
  const [filters, setFilters] = useState<GmailFilter[]>([]);
  const [forwarding, setForwarding] = useState<ForwardingAddress[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // create-filter form
  const [from, setFrom] = useState("");
  const [subject, setSubject] = useState("");
  const [query, setQuery] = useState("");
  const [forwardTo, setForwardTo] = useState("hello@vargasjr.dev");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const s = await fetch("/api/gmail/status", { headers: authHeaders() }).then((r) => r.json());
      setStatus(s);
      if (s.connected) {
        const [f, fw] = await Promise.all([
          fetch("/api/gmail/filters", { headers: authHeaders() }).then((r) => r.json()),
          fetch("/api/gmail/forwarding", { headers: authHeaders() }).then((r) => r.json()),
        ]);
        setFilters(f.filters ?? []);
        setForwarding(fw.forwardingAddresses ?? []);
        if (f.error) setError(f.error);
      }
    } catch {
      setError("failed to load status");
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem("admin_token")) {
      setAuthed(true);
      refresh();
    }
  }, [refresh]);

  // surface ?error= / ?connected= from the OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error")) setError(params.get("error")!);
    if (params.get("connected")) setNotice("Gmail connected.");
    if (params.get("error") || params.get("connected")) {
      window.history.replaceState({}, "", "/admin/gmail");
    }
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const res = await fetch("/api/gmail/filters", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ from, subject, query, forwardTo }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.error) setError(data.error);
    else {
      setNotice("Filter created.");
      setFrom("");
      setSubject("");
      setQuery("");
      refresh();
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    const res = await fetch(`/api/gmail/filters?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    const data = await res.json();
    setBusy(false);
    if (data.error) setError(data.error);
    else refresh();
  }

  async function handleVerifyAddress() {
    setBusy(true);
    setError("");
    const res = await fetch("/api/gmail/forwarding", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ email: forwardTo }),
    });
    const data = await res.json();
    setBusy(false);
    if (data.error) setError(data.error);
    else {
      setNotice(data.note ?? "verification email sent");
      refresh();
    }
  }

  if (!authed) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-300">
        <p>
          Not authorized — log in at{" "}
          <Link href="/admin" className="text-[#3ba4dc]">
            /admin
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Gmail Filters</h1>
          <Link href="/admin" className="text-sm text-gray-500 hover:text-gray-300">
            ← Admin
          </Link>
        </div>

        {error && (
          <p className="mb-4 p-3 rounded-lg bg-red-900/40 border border-red-800 text-red-200 text-sm">{error}</p>
        )}
        {notice && (
          <p className="mb-4 p-3 rounded-lg bg-green-900/40 border border-green-800 text-green-200 text-sm">{notice}</p>
        )}

        {!status ? (
          <p className="text-gray-500 text-sm">Loading…</p>
        ) : !status.connected ? (
          <div className="p-6 rounded-xl bg-gray-900 border border-gray-800 text-center">
            <p className="text-gray-300 text-sm mb-4">
              Connect a Google account to manage its email filters. Access is limited to
              Gmail <em>settings</em> (filters + forwarding) — no mail content, no sending.
            </p>
            <a
              href="/api/gmail/connect"
              className="inline-block px-5 py-3 rounded-lg bg-[#3ba4dc] text-white font-semibold hover:bg-[#2990c5] transition-colors"
            >
              Connect Gmail
            </a>
          </div>
        ) : (
          <>
            <div className="mb-6 p-4 rounded-xl bg-gray-900 border border-gray-800">
              <p className="text-sm text-gray-400">
                Connected as <span className="text-gray-100 font-semibold">{status.email}</span>
              </p>
            </div>

            <section className="mb-8">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Existing filters
              </h2>
              {filters.length === 0 ? (
                <p className="text-gray-500 text-sm">No filters.</p>
              ) : (
                <ul className="space-y-2">
                  {filters.map((f) => (
                    <li
                      key={f.id}
                      className="flex items-start justify-between gap-4 p-3 rounded-lg bg-gray-900 border border-gray-800"
                    >
                      <div className="text-sm min-w-0">
                        <p className="text-gray-200 break-words">
                          {f.criteria.from && <>from: <code className="text-[#3ba4dc]">{f.criteria.from}</code> </>}
                          {f.criteria.subject && <>subject: <code className="text-[#3ba4dc]">{f.criteria.subject}</code> </>}
                          {f.criteria.query && <>query: <code className="text-[#3ba4dc]">{f.criteria.query}</code></>}
                        </p>
                        <p className="text-gray-500 text-xs mt-1">
                          {f.action.forwardTo
                            ? `forwards to ${f.action.forwardTo}`
                            : `labels: ${[...(f.action.addLabelIds ?? []), ...(f.action.removeLabelIds ?? [])].join(", ") || "none"}`}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDelete(f.id)}
                        disabled={busy}
                        className="text-xs text-red-400 hover:text-red-300 border border-red-900 rounded-md px-2 py-1 flex-shrink-0 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="mb-8">
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                New filter
              </h2>
              <form onSubmit={handleCreate} className="space-y-3 p-4 rounded-xl bg-gray-900 border border-gray-800">
                <input
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  placeholder="From contains (optional)"
                  className="w-full p-2.5 rounded-lg bg-gray-950 border border-gray-800 text-sm focus:outline-none focus:border-[#3ba4dc]"
                />
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject contains (optional)"
                  className="w-full p-2.5 rounded-lg bg-gray-950 border border-gray-800 text-sm focus:outline-none focus:border-[#3ba4dc]"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Raw Gmail query, e.g. has:attachment (optional)"
                  className="w-full p-2.5 rounded-lg bg-gray-950 border border-gray-800 text-sm focus:outline-none focus:border-[#3ba4dc]"
                />
                <input
                  value={forwardTo}
                  onChange={(e) => setForwardTo(e.target.value)}
                  placeholder="Forward to (optional)"
                  className="w-full p-2.5 rounded-lg bg-gray-950 border border-gray-800 text-sm focus:outline-none focus:border-[#3ba4dc]"
                />
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="submit"
                    disabled={busy || (!from && !subject && !query)}
                    className="px-4 py-2 rounded-lg bg-[#3ba4dc] text-white text-sm font-semibold hover:bg-[#2990c5] transition-colors disabled:opacity-50"
                  >
                    Create filter
                  </button>
                  <button
                    type="button"
                    onClick={handleVerifyAddress}
                    disabled={busy || !forwardTo}
                    className="text-xs text-gray-400 hover:text-gray-200 disabled:opacity-50"
                  >
                    Send forwarding verification email
                  </button>
                </div>
                <p className="text-xs text-gray-600">
                  Forwarding requires a verified destination address — use the verification
                  link once; VargasJR confirms it from the hello@ inbox.
                </p>
              </form>
            </section>

            {forwarding.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Forwarding addresses
                </h2>
                <ul className="space-y-1 text-sm">
                  {forwarding.map((f) => (
                    <li key={f.forwardingEmail} className="flex justify-between text-gray-300">
                      <span>{f.forwardingEmail}</span>
                      <span className={f.verificationStatus === "accepted" ? "text-green-400" : "text-yellow-400"}>
                        {f.verificationStatus}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </main>
  );
}
