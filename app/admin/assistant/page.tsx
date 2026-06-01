"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AssistantPage() {
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem("admin_token")) {
      router.replace("/admin");
    } else {
      setReady(true);
    }
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
