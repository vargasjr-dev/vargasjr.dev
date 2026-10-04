"use client";

import { useState } from "react";
import Link from "next/link";

// The opt-in disclosure is duplicated verbatim in
// app/api/sms/opt-in/route.ts (OPT_IN_DISCLOSURE) so consent records capture
// exactly what the user saw. If you change it here, change it there and bump
// CONSENT_VERSION.
export const OPT_IN_DISCLOSURE_DISPLAY = (
  <>
    By checking this box and submitting my phone number, I agree to receive
    text messages from <strong>VargasJR</strong>, the AI assistant service
    operated by <strong>Vargas JR, LLC</strong>, from the toll-free number{" "}
    <strong>+1 (833) 659-7364</strong>. Messages include task confirmations,
    calendar and deadline reminders, status alerts, and one-to-one
    conversational replies to requests I&apos;ve made. Message frequency
    varies. Message and data rates may apply. Reply <strong>STOP</strong> to
    opt out or <strong>HELP</strong> for help. Consent is optional and not
    required to use any other part of vargasjr.dev. See our{" "}
    <Link href="/terms" className="text-primary underline">
      Terms &amp; Conditions
    </Link>{" "}
    and{" "}
    <Link href="/privacy" className="text-primary underline">
      Privacy Policy
    </Link>
    .
  </>
);

export function OptInForm() {
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!consent) return;
    setStatus("submitting");
    setError(null);
    try {
      const res = await fetch("/api/sms/opt-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, consent }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("success");
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-green-700/50 bg-green-950/40 p-6">
        <p className="font-semibold text-green-300">
          You&apos;re opted in. Thanks!
        </p>
        <p className="mt-2 text-gray-300">
          Expect a text from <strong>+1 (833) 659-7364</strong> when there&apos;s
          something to tell you. Message frequency varies. Changed your mind?
          Reply <strong>STOP</strong> to opt out at any time.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="phone"
          className="block text-sm font-medium text-gray-200 mb-1"
        >
          Your mobile phone number
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          required
          placeholder="(555) 123-4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-3 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
        />
      </div>

      <label className="flex items-start gap-3 text-sm text-gray-300 leading-relaxed cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 h-4 w-4 flex-shrink-0 accent-primary"
        />
        <span>{OPT_IN_DISCLOSURE_DISPLAY}</span>
      </label>

      {status === "error" && error && (
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!consent || status === "submitting"}
        className="rounded-lg bg-primary px-6 py-3 font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
      >
        {status === "submitting" ? "Opting in…" : "Opt in to SMS"}
      </button>
    </form>
  );
}
