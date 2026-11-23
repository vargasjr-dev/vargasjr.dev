"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ASSISTANT_RETURN_KEY } from "@/lib/assistant-navigation";

const EmbeddedApp = dynamic(
  // eslint-disable-next-line custom/no-inline-imports -- Browser-only package must not run during SSR.
  () => import("@mycadet/app").then((mod) => mod.EmbeddedApp),
  { ssr: false },
);

export function CadetDev() {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const controller = new AbortController();
    const login = () => {
      sessionStorage.setItem(
        ASSISTANT_RETURN_KEY,
        location.pathname + location.search + location.hash,
      );
      router.replace("/admin/");
    };
    const token = localStorage.getItem("admin_token");
    if (!token) {
      login();
      return;
    }
    void fetch("/api/admin/validate-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (data.valid) setReady(true);
        else login();
      })
      .catch(() => {
        if (!controller.signal.aborted) login();
      });
    return () => controller.abort();
  }, [router]);
  return (
    <main className="h-dvh w-full" data-theme="dark">
      <link rel="stylesheet" href="/cadet-dev/app.css" />
      {ready ? (
        <EmbeddedApp basename="/admin/dev" />
      ) : (
        <p className="p-8">Loading…</p>
      )}
    </main>
  );
}
