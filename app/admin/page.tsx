"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

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
      router.push("/admin/connect-bank");
    } else {
      setError("Invalid token.");
    }
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
