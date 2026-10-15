"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ASSISTANT_RETURN_KEY,
  parentToSpa,
  assistantFrameUrl,
  assistantNavigationMessage,
  spaToParent,
} from "@/lib/assistant-navigation";

/**
 * One iframe loads Cadet directly from its same-site HTTPS subdomain.
 * Navigation messages are accepted only from the active frame and its exact
 * origin. Cadet must emit the navigation protocol itself; the website cannot
 * inject scripts or read history across origins. Parent back/forward reloads
 * a cross-origin frame.
 */

function fullUrl(): string {
  return (
    window.location.pathname + window.location.search + window.location.hash
  );
}

export default function AssistantPage() {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  useEffect(() => {
    setIframeSrc(assistantFrameUrl(fullUrl()));
  }, []);

  // ── Auth gate ───────────────────────────────────────────────────────────
  useEffect(() => {
    const goToLogin = () => {
      try {
        sessionStorage.setItem(ASSISTANT_RETURN_KEY, fullUrl());
      } catch {
        /* Storage is unavailable; login still works. */
      }
      router.replace("/admin");
    };
    const token = localStorage.getItem("admin_token");
    if (!token) {
      goToLogin();
      return;
    }
    // Re-validate the HttpOnly admin_session cookie on every mount — localStorage
    // persists across sessions but the cookie has a 1-week TTL.
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
          goToLogin();
        }
      })
      .catch(() => {
        goToLogin();
      });
  }, [router]);

  // ── SPA → parent URL sync + parent → SPA back/forward ───────────────────
  useEffect(() => {
    if (!ready) return;

    // SPA → parent: listen for postMessage from the iframe.
    function onMessage(event: MessageEvent) {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;
      if (
        event.source !== iframe.contentWindow ||
        event.origin !== new URL(iframe.src, window.location.href).origin
      )
        return;

      const data = assistantNavigationMessage(event.data);
      if (!data) return;

      const parentUrl = spaToParent(data.path);
      const current = fullUrl();
      if (parentUrl === current) return; // loop guard

      if (data.nav === "push") {
        window.history.pushState(null, "", parentUrl);
      } else {
        // 'replace' or 'pop' — don't grow the history stack.
        window.history.replaceState(null, "", parentUrl);
      }
    }

    // Parent → SPA: browser back/forward drives the iframe.
    function onPopState() {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;

      const currentFrame = new URL(iframe.src, window.location.href);
      const spaPath = parentToSpa(fullUrl());
      if (currentFrame.origin !== window.location.origin) {
        setIframeSrc(new URL(spaPath, currentFrame.origin).href);
        return;
      }
      const w = iframe.contentWindow;
      try {
        w.history.replaceState(w.history.state, "", spaPath);
        w.dispatchEvent(new PopStateEvent("popstate"));
      } catch {
        setIframeSrc(spaPath);
      }
    }

    window.addEventListener("message", onMessage);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onPopState);
    return () => {
      window.removeEventListener("message", onMessage);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onPopState);
    };
  }, [ready]);

  // Always render the iframe so the SPA's self-hosted handshake starts
  // immediately — in parallel with the admin token validation — rather than
  // waiting for auth to complete first. The SPA is hidden via CSS until auth
  // passes; if auth fails the user is redirected to /admin before the SPA
  // ever becomes visible. This eliminates the "stuck loading" skeleton caused
  // by the SPA spending its handshake window waiting for auth to finish.
  return (
    <main className="h-dvh w-screen overflow-hidden">
      {!ready && (
        <div className="absolute inset-0 bg-gray-950 flex items-center justify-center z-10">
          <p className="text-gray-500 text-sm">Loading...</p>
        </div>
      )}
      {iframeSrc && (
        <iframe
          ref={iframeRef}
          src={iframeSrc}
          className="w-full h-full border-0"
          title="VargasJR Assistant"
          allow="microphone; camera; clipboard-write"
        />
      )}
    </main>
  );
}
