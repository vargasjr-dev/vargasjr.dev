"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  ASSISTANT_RETURN_KEY,
  parentToSpa,
  spaToParent,
} from "@/lib/assistant-navigation";

/**
 * Admin shell that hosts the @vellumai/web SPA inside an iframe and keeps the
 * parent browser URL in sync with the SPA's internal route.
 *
 * URL mapping: the SPA mounts under /assistant/... and the admin shell mirrors
 * that under /admin/assistant/... — so /assistant/conversations/123/ ↔
 * /admin/assistant/conversations/123/. On reload of a deep admin URL, the
 * catch-all route renders here, the iframe src is set to the matching SPA path,
 * and the assistant catch-all (app/assistant/[[...slug]]/route.ts) serves
 * index.html so the SPA boots at the right screen.
 *
 * Sync protocol (SPA → parent):
 *   copy-assistant.ts injects a script into the SPA's index.html that
 *   monkeypatches history.pushState/replaceState + listens for
 *   popstate/hashchange, and postMessages the parent with { source:
 *   'vellum-spa-nav', nav: 'push'|'replace'|'pop', path }. The parent mirrors
 *   the URL using pushState (for 'push') or replaceState (for 'replace'/'pop').
 *
 * Sync protocol (parent → SPA, back/forward):
 *   The parent's popstate listener derives the SPA path from the current
 *   browser URL and drives the iframe via replaceState(preserve state) +
 *   synthetic PopStateEvent — the SPA's history-lib router re-reads
 *   window.location and re-resolves without a full reload.
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
  // Suppresses the message-listener update when WE drove the iframe (back/fwd).
  const suppressSync = useRef(false);

  const [iframeSrc, setIframeSrc] = useState<string | null>(null);
  useEffect(() => {
    setIframeSrc(parentToSpa(fullUrl()));
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
        event.origin !== window.location.origin
      )
        return;

      const data = event.data;
      if (
        !data ||
        data.source !== "vellum-spa-nav" ||
        typeof data.path !== "string" ||
        !data.path.startsWith("/assistant/")
      )
        return;

      // If we just drove the iframe, let its echo through and no-op.
      if (suppressSync.current) {
        suppressSync.current = false;
        return;
      }

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

      const spaPath = parentToSpa(fullUrl());
      const w = iframe.contentWindow;

      // Preserve history.state (the history lib's internal idx) or the
      // router's back/forward bookkeeping corrupts.
      try {
        w.history.replaceState(w.history.state, "", spaPath);
        w.dispatchEvent(new PopStateEvent("popstate"));
        suppressSync.current = true;
      } catch {
        // Cross-origin or not-yet-loaded — fall back to a full src reload.
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
