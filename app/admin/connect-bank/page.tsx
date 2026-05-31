"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Plaid: any;
  }
}

export default function ConnectBankPage() {
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [message, setMessage] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      router.replace("/admin");
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.plaid.com/link/v2/stable/link-initialize.js";
    script.async = true;
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [router]);

  async function handleConnect() {
    const adminToken = localStorage.getItem("admin_token") ?? "";
    setStatus("loading");
    setMessage("Creating link token...");

    try {
      const tokenRes = await fetch("/api/admin/plaid/link-token", {
        method: "POST",
        headers: { "x-admin-token": adminToken },
      });
      const tokenData = await tokenRes.json();

      if (!tokenData.link_token) {
        setStatus("error");
        setMessage("Failed to get link token: " + JSON.stringify(tokenData));
        return;
      }

      const handler = window.Plaid.create({
        token: tokenData.link_token,
        onSuccess: async (
          publicToken: string,
          metadata: { institution?: { name?: string } },
        ) => {
          setMessage(
            `Connected to ${metadata?.institution?.name ?? "bank"}. Exchanging token...`,
          );

          const exchRes = await fetch("/api/admin/plaid/exchange", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-admin-token": adminToken,
            },
            body: JSON.stringify({ public_token: publicToken }),
          });
          const exchData = await exchRes.json();

          if (exchData.success) {
            setStatus("success");
            setMessage(exchData.access_token);
          } else {
            setStatus("error");
            setMessage("Exchange failed: " + JSON.stringify(exchData));
          }
        },
        onExit: (err: { display_message?: string } | null) => {
          if (err) {
            setStatus("error");
            setMessage(err.display_message ?? "Link exited with error");
          } else {
            setStatus("idle");
            setMessage("");
          }
        },
      });

      handler.open();
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Unknown error");
    }
  }

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-full max-w-md p-8 text-center">
        <h1 className="text-2xl font-bold text-[#3ba4dc] mb-2">
          ⚔️ Connect Bank
        </h1>
        <p className="text-gray-400 text-sm mb-8">
          Sunday Fundsday — Capital One connection
        </p>

        {status !== "success" && (
          <button
            onClick={handleConnect}
            disabled={status === "loading"}
            className="px-8 py-4 rounded-lg bg-[#3ba4dc] text-white font-semibold text-lg disabled:opacity-50 disabled:cursor-wait hover:bg-[#2990c5] transition-colors"
          >
            {status === "loading" ? "Connecting..." : "Connect Capital One"}
          </button>
        )}

        {status === "success" && message && (
          <div className="mt-6 text-left">
            <p className="text-green-400 text-sm mb-2 font-semibold">
              ✅ Connected! Copy this access token and give it to VargasJR via
              the secure vault prompt:
            </p>
            <textarea
              readOnly
              value={message}
              className="w-full p-3 rounded-lg bg-gray-800 text-green-300 font-mono text-xs border border-green-800 resize-none"
              rows={3}
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
          </div>
        )}

        {status !== "success" && message && (
          <div
            className={`mt-6 p-4 rounded-lg text-sm ${
              status === "error"
                ? "bg-red-950 text-red-400 border border-red-900"
                : "bg-blue-950 text-[#3ba4dc] border border-blue-900"
            }`}
          >
            {message}
          </div>
        )}
      </div>
    </main>
  );
}
