import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import { gatewayAssistantUrl } from "@/lib/assistant-navigation";

/**
 * Serves the assistant SPA shell at any deep path under /assistant/ (e.g.
 * /assistant/conversations/123/). The SPA uses path-based browser history
 * routing, so on a hard reload of a deep link the browser needs the shell
 * back — without this route, Next 404s and the SPA never boots.
 *
 * TWO shells:
 *   - cadet (default): the gateway's current HTML, served on this site's
 *     origin. Assets and API requests are forwarded to CADET_GATEWAY_URL
 *     by proxy.ts. This keeps refresh cookies first-party inside the admin
 *     frame; the injected history bridge synchronizes navigation.
 *     No @mycadet/web bundle is installed in this repository.
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
 * Cadet assets and APIs are routed to the gateway by proxy.ts before the
 * filesystem layer. Vellum retains its public assets and legacy API rewrites.
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

// The same click-to-switch pill copy-assistant.ts injects into vellum.html —
// duplicated here because the cadet shell is generated at request time, not
// at build time. Keep the two in sync.
const pillScript = `<script>/*web-bundle-pill*/(function(){try{var K="webClientBundle";function cur(){return localStorage.getItem(K)==="vellum"?"vellum":"cadet"}var b=document.createElement("button");function render(){b.textContent="web: "+cur()}function toggle(){var n=cur()==="vellum"?"cadet":"vellum";localStorage.setItem(K,n);document.cookie=K+"="+n+";path=/;max-age=31536000;samesite=lax";location.reload()}render();b.style.cssText="position:fixed;bottom:10px;left:50%;transform:translateX(-50%);z-index:2147483647;opacity:.5;background:#111;color:#eee;border:1px solid #555;border-radius:999px;font:11px ui-monospace,SFMono-Regular,monospace;padding:4px 10px;cursor:pointer";b.onclick=toggle;b.onmouseenter=function(){b.style.opacity="1"};b.onmouseleave=function(){b.style.opacity=".5"};document.body.appendChild(b)}catch(e){}})();</script>`;

// Navigation stays in the same-origin admin frame so the HttpOnly gateway
// refresh cookie remains first-party across reloads.
const navigationBridge = `<script>(function(){function send(nav){if(parent!==window)parent.postMessage({source:"vellum-spa-nav",nav:nav,path:location.pathname+location.search+location.hash},location.origin)}["pushState","replaceState"].forEach(function(name){var original=history[name];history[name]=function(){var result=original.apply(this,arguments);send(name==="pushState"?"push":"replace");return result}});addEventListener("popstate",function(){send("pop")});addEventListener("hashchange",function(){send("replace")});send("replace")})();</script>`;

async function cadetShellHtml(spaPath: string): Promise<NextResponse> {
  const gatewayUrl = process.env.CADET_GATEWAY_URL;
  if (!gatewayUrl)
    return new NextResponse("Cadet gateway is not configured", { status: 503 });
  try {
    const upstream = await fetch(gatewayAssistantUrl(gatewayUrl, spaPath), {
      cache: "no-store",
      headers: { "ngrok-skip-browser-warning": "1" },
      signal: AbortSignal.timeout(15000),
    });
    if (
      !upstream.ok ||
      !upstream.headers.get("content-type")?.includes("text/html")
    ) {
      return new NextResponse("Cadet gateway did not return its web client", {
        status: 502,
      });
    }
    const html = await upstream.text();
    // Vercel HTTP rewrites do not carry WebSocket upgrades. Cadet authenticates
    // these connections with its actor token, so keep them on the gateway.
    const socketBase = JSON.stringify(
      gatewayAssistantUrl(gatewayUrl, "/"),
    ).replace(/</g, "\\u003c");
    const socketBridge = `<script>(function(){if(!window.WebSocket)return;var Native=window.WebSocket;window.WebSocket=class extends Native{constructor(url,protocols){var target=new URL(url,location.href);if(target.host===location.host&&(target.protocol==="ws:"||target.protocol==="wss:")&&(target.pathname.startsWith("/v1/")||target.pathname.startsWith("/v2/"))){var base=new URL(${socketBase});base.protocol=base.protocol==="http:"?"ws:":"wss:";base.pathname=base.pathname.replace(/\\/$/,"")+target.pathname;base.search=target.search;base.hash=target.hash;url=base.href}super(url,protocols)}}})();</script>`;
    const scripts = navigationBridge + socketBridge;
    const document = html.includes("</head>")
      ? html.replace("</head>", scripts + "</head>")
      : scripts + html;
    return new NextResponse(
      document.replace("</body>", pillScript + "</body>"),
      {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return new NextResponse("Cadet gateway is unavailable", { status: 502 });
  }
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
    return cadetShellHtml(url.pathname + url.search);
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
