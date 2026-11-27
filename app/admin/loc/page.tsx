"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { z } from "zod";

type Snapshot = z.infer<typeof SnapshotShape>;

const SnapshotShape = z.object({
  measuredAt: z.string(),
  head: z.string(),
  headDate: z.string(),
  loc: z.number(),
  baseLoc: z.number(),
  net: z.number(),
  files: z.number(),
  goal: z.number(),
  history: z.array(
    z.object({ date: z.string(), head: z.string(), net: z.number() }),
  ),
});

// The measurement lives on the cadet repo's data/loc branch — the daily
// workflow there recomputes it and pushes; raw.githubusercontent serves it
// with CORS open, so the page reads it straight from the browser.
const SNAPSHOT_URL =
  "https://raw.githubusercontent.com/vargasjr-dev/mycadet-temp/data/loc/meta/loc-since-rebrand.json";

const fmt = (n: number) => n.toLocaleString("en-US");

function relative(dateIso: string): string {
  const days = Math.floor(
    (Date.now() - new Date(dateIso).getTime()) / 86_400_000,
  );
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default function LocAdminPage() {
  const router = useRouter();
  const [authed, setAuthed] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      router.replace("/admin");
      return;
    }
    setAuthed(true);
  }, []);

  useEffect(() => {
    if (!authed) return;
    void fetch(SNAPSHOT_URL)
      .then(async (r) => {
        if (!r.ok) throw new Error(`snapshot ${r.status}`);
        return SnapshotShape.parse(await r.json());
      })
      .then(setSnapshot)
      .catch(() => setError("Couldn't load the measurement."));
  }, [authed]);

  if (!authed) return null;

  const progress = snapshot
    ? Math.min(100, (snapshot.net / snapshot.goal) * 100)
    : 0;
  const trend =
    snapshot && snapshot.history.length > 1
      ? snapshot.net - snapshot.history[snapshot.history.length - 2].net
      : null;

  return (
    <main className="min-h-dvh bg-[#0d1117] text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-[#3ba4dc] mb-1">
              ⚰️ Rebrand LoC
            </h1>
            <p className="text-gray-400 text-sm">
              Net source lines since the vellum → cadet rebrand point. Goal:
              −1,000,000.
            </p>
          </div>
          <Link
            href="/admin/"
            className="text-gray-400 hover:text-white text-sm"
          >
            ← Admin
          </Link>
        </div>

        {error && <p className="text-red-400 mb-4">{error}</p>}
        {!snapshot && !error && <p className="text-gray-400">Measuring…</p>}

        {snapshot && (
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-900 border border-gray-800 p-6 text-center">
              <div className="text-5xl font-bold text-[#3ba4dc] tabular-nums">
                {fmt(snapshot.net)}
              </div>
              <div className="text-gray-400 text-sm mt-2">
                source lines vs the rebrand-point tree ({fmt(snapshot.baseLoc)})
              </div>
            </div>

            <div className="rounded-lg bg-gray-900 border border-gray-800 p-6">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Progress to −1,000,000</span>
                <span className="tabular-nums">{progress.toFixed(1)}%</span>
              </div>
              <div className="h-3 rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full bg-[#3ba4dc]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-lg bg-gray-900 border border-gray-800 p-4">
                <div className="text-gray-400 text-xs mb-1">Current tree</div>
                <div className="text-xl font-semibold tabular-nums">
                  {fmt(snapshot.loc)}
                </div>
                <div className="text-gray-500 text-xs">
                  across {fmt(snapshot.files)} files
                </div>
              </div>
              <div className="rounded-lg bg-gray-900 border border-gray-800 p-4">
                <div className="text-gray-400 text-xs mb-1">Trend</div>
                <div
                  className={`text-xl font-semibold tabular-nums ${
                    trend === null
                      ? ""
                      : trend <= 0
                        ? "text-green-400"
                        : "text-red-400"
                  }`}
                >
                  {trend === null
                    ? "—"
                    : `${trend <= 0 ? "" : "+"}${fmt(trend)}`}
                </div>
                <div className="text-gray-500 text-xs">
                  vs the previous measurement
                </div>
              </div>
            </div>

            <p className="text-gray-500 text-xs text-center">
              Measured {relative(snapshot.measuredAt)} at{" "}
              <span className="font-mono">{snapshot.head}</span> (
              {snapshot.headDate}) — daily by the cadet repo's loc-measurement
              workflow.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
