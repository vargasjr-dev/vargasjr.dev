"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AssistantPage() {
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      router.replace("/admin");
      return;
    }
    // Re-validate on every mount to ensure the admin_session HttpOnly cookie
    // is refreshed. localStorage persists across sessions but the cookie has a
    // 1-week TTL — without this, the SPA's lockfile fetch returns 401 after
    // the cookie expires even though the user appears "logged in".
    fetch("/api/admin/validate-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.valid) {
          setReady(true);
        } else {
          localStorage.removeItem("admin_token");
          router.replace("/admin");
        }
      })
      .catch(() => {
        router.replace("/admin");
      });
  }, [router]);

  if (!ready) {
    return (
      <main className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500 text-sm">Loading...</p>
      </main>
    );
  }

  return (
    <main className="h-screen w-screen overflow-hidden">
      <iframe
        src="/assistant/"
        className="w-full h-full border-0"
        title="VargasJR Assistant"
        allow="microphone; camera; clipboard-write"
      />
    </main>
  );
}
