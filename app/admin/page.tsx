"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function AdminPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("admin_token")) {
      setAuthed(true);
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/admin/validate-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.valid) {
      localStorage.setItem("admin_token", token);
      setAuthed(true);
    } else {
      setError("Invalid token.");
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    localStorage.removeItem("admin_token");
    setAuthed(false);
  }

  if (authed) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-full max-w-sm p-8 text-center">
          <h1 className="text-2xl font-bold text-[#3ba4dc] mb-2">⚔️ Admin</h1>
          <p className="text-gray-400 text-sm mb-8">
            Private area — VargasJR only
          </p>
          <div className="space-y-3">
            <Link
              href="/admin/assistant"
              className="block w-full py-3 rounded-lg bg-[#3ba4dc] text-white font-semibold hover:bg-[#2990c5] transition-colors"
            >
              Assistant
            </Link>
            <Link
              href="/admin/connect-bank"
              className="block w-full py-3 rounded-lg bg-gray-800 text-gray-200 font-semibold hover:bg-gray-700 transition-colors"
            >
              Bank Info
            </Link>
            <button
              onClick={handleLogout}
              className="block w-full py-3 rounded-lg bg-transparent text-gray-500 text-sm hover:text-gray-300 transition-colors"
            >
              Log out
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-sm p-8 text-center">
        <h1 className="text-2xl font-bold text-[#3ba4dc] mb-2">⚔️ Admin</h1>
        <p className="text-gray-400 text-sm mb-8">
          Private area — VargasJR only
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="password"
            placeholder="Admin token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full px-4 py-3 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-[#3ba4dc]"
          />
          <button
            type="submit"
            disabled={loading || !token}
            className="w-full py-3 rounded-lg bg-[#3ba4dc] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#2990c5] transition-colors"
          >
            {loading ? "Checking..." : "Enter"}
          </button>
          {error && <p className="text-red-400 text-sm">{error}</p>}
        </form>
      </div>
    </main>
  );
}
