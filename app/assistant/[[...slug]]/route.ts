import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * Serves the assistant SPA shell at any deep path under /assistant/ (e.g.
 * /assistant/conversations/123/). The SPA uses path-based browser history
 * routing, so on a hard reload of a deep link the browser needs the shell
 * back — without this route, Next 404s and the SPA never boots.
 *
 * TWO shells:
 *   - cadet (default): a thin document that loads the cadet gateway DIRECTLY
 *     in a full-viewport iframe — no @mycadet/web bundle ships in this repo
 *     at all. The gateway URL comes from CADET_GATEWAY_URL at request time
 *     (set on Vercel to the gateway's ngrok URL). The gateway serves its own
 *     web bundle and API on its own origin, so nothing is proxied or
 *     patched here.
 *   - vellum: @vellumai/web, the inline revert shell (see
 *     scripts/copy-assistant.ts), kept for an instant revert.
 *
 * Which shell is served follows the runtime bundle switch: the
 * `webClientBundle` localStorage key ("cadet" | "vellum") is mirrored into
 * a same-named cookie by an injected snippet, and proxy.ts (middleware)
 * resolves that cookie into the `x-web-client-bundle` request header. This
 * route prefers the header, falls back to reading the cookie directly, and
 * defaults to cadet. `?bundle=vellum|cadet` is the server-side escape
 * hatch — it sets the cookie and sheds the param, so a shell that won't
 * even boot can still be swapped without touching localStorage.
 *
 * Static assets under /assistant/assets/*, /assistant/fonts/*, etc. are
 * served by Next's public-file layer before this dynamic route is reached,
 * so those are unaffected. The __local/__gateway rewrites in next.config.ts
 * also run before filesystem/dynamic routes, so API traffic is untouched.
 *
 * Guard: any slug segment starting with `__` or containing `.` is 404'd —
 * defense-in-depth so this catch-all can't shadow API/asset paths.
 */

function cookieValue(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// The same click-to-switch pill copy-assistant.ts injects into vellum.html —
// duplicated here because the cadet shell is generated at request time, not
// at build time. Keep the two in sync.
const pillScript = `<script>/*web-bundle-pill*/(function(){try{var K="webClientBundle";function cur(){return localStorage.getItem(K)==="vellum"?"vellum":"cadet"}var b=document.createElement("button");function render(){b.textContent="web: "+cur()}function toggle(){var n=cur()==="vellum"?"cadet":"vellum";localStorage.setItem(K,n);document.cookie=K+"="+n+";path=/;max-age=31536000;samesite=lax";location.reload()}render();b.style.cssText="position:fixed;bottom:10px;right:10px;z-index:2147483647;opacity:.5;background:#111;color:#eee;border:1px solid #555;border-radius:999px;font:11px ui-monospace,SFMono-Regular,monospace;padding:4px 10px;cursor:pointer";b.onclick=toggle;b.onmouseenter=function(){b.style.opacity="1"};b.onmouseleave=function(){b.style.opacity=".5"};document.body.appendChild(b)}catch(e){}})();</script>`;

function cadetShellHtml(): NextResponse {
  let gatewayUrl = process.env.CADET_GATEWAY_URL ?? "";

  // The gateway process itself serves no bundle — everything but webhooks,
  // audio, and A2A discovery sits behind edge auth, so a bare hit 401s. The
  // web bundle lives one layer out: the cadet web ingress serves it
  // publicly at /assistant/ (and / 302s there), while the platform
  // gateway's /assistant 302s to /web/<newest>/assistant/. Append that
  // canonical route when the configured URL carries no path of its own.
  if (gatewayUrl) {
    try {
      const parsed = new URL(gatewayUrl);
      if (parsed.pathname === "/" || parsed.pathname === "") {
        gatewayUrl = `${parsed.origin}/assistant/`;
      }
    } catch {
      // Not a valid absolute URL — hand it to the iframe as-is and let the
      // failure be visible instead of guessing.
    }
  }

  const body = gatewayUrl
    ? `<iframe src="${escapeHtmlAttr(gatewayUrl)}" title="cadet assistant" allow="clipboard-read; clipboard-write" style="border:0;height:100%;width:100%"></iframe>`
    : `<p style="font:14px ui-monospace,SFMono-Regular,monospace;padding:2rem">cadet gateway not configured — set CADET_GATEWAY_URL (the gateway's ngrok URL) to load it here.</p>`;

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>web: cadet</title><style>html,body{margin:0;padding:0;height:100%}</style></head><body>${body}${pillScript}</body></html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug?: string[] }> },
) {
  const { slug } = await params;

  if (slug) {
    for (const segment of slug) {
      if (segment.startsWith("__") || segment.includes(".")) {
        return new NextResponse("Not found", { status: 404 });
      }
    }
  }

  // ?bundle= escape hatch: persist the choice and shed the param.
  const url = new URL(req.url);
  const bundleParam = url.searchParams.get("bundle");
  if (bundleParam === "vellum" || bundleParam === "cadet") {
    url.searchParams.delete("bundle");
    const response = NextResponse.redirect(url, 302);
    response.cookies.set("webClientBundle", bundleParam, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
    });
    return response;
  }

  const header = req.headers.get("x-web-client-bundle");
  const requested =
    header === "vellum" || header === "cadet"
      ? header
      : cookieValue(req.headers.get("cookie"), "webClientBundle");

  if (requested !== "vellum") {
    return cadetShellHtml();
  }

  try {
    const html = await readFile(
      join(process.cwd(), "public", "assistant", "vellum.html"),
      "utf-8",
    );
    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
