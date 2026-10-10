import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * Serves the assistant SPA shell at any deep path under /assistant/ (e.g.
 * /assistant/conversations/123/). The SPA uses path-based browser history
 * routing, so on a hard reload of a deep link the browser needs the shell
 * back — without this route, Next 404s and the SPA never boots.
 *
 * TWO shells ship side by side (see scripts/copy-assistant.ts):
 *   - index.html  = @mycadet/web (the default bundle)
 *   - vellum.html = @vellumai/web (kept for an instant revert)
 * Both reference the same shared /assistant/assets/* dir (content-hashed
 * filenames don't collide across dists).
 *
 * Which shell is served follows the runtime bundle switch: the SPA's
 * `webClientBundle` localStorage key ("cadet" | "vellum") is mirrored into a
 * same-named cookie by an injected snippet, and proxy.ts (middleware)
 * resolves that cookie into the `x-web-client-bundle` request header. This
 * route prefers the header, falls back to reading the cookie directly, and
 * defaults to cadet. `?bundle=vellum|cadet` is the server-side escape hatch
 * — it sets the cookie and sheds the param, so a bundle that won't even
 * boot can still be swapped without touching localStorage.
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

  const shell = requested === "vellum" ? "vellum.html" : "index.html";

  try {
    const html = await readFile(
      join(process.cwd(), "public", "assistant", shell),
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
