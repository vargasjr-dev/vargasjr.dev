import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * Serves the Vellum SPA shell (public/assistant/index.html) at any deep path
 * under /assistant/ (e.g. /assistant/conversations/123/). The SPA uses
 * path-based browser history routing, so on a hard reload of a deep link the
 * browser needs index.html back — without this route, Next 404s and the SPA
 * never boots.
 *
 * Static assets under /assistant/assets/*, /assistant/fonts/*, etc. are served
 * by Next's public-file layer before this dynamic route is reached, so those
 * are unaffected. The __local/__gateway rewrites in next.config.ts also run
 * before filesystem/dynamic routes, so API traffic is untouched.
 *
 * Guard: any slug segment starting with `__` or containing `.` is 404'd —
 * defense-in-depth so this catch-all can't shadow API/asset paths.
 */
export async function GET(
  _req: Request,
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

  const indexPath = join(process.cwd(), "public", "assistant", "index.html");

  try {
    const html = await readFile(indexPath, "utf-8");
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
