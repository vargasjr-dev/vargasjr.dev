import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";
import {
  gatewayAssistantUrl,
  ASSISTANT_GATEWAY_ORIGIN,
} from "@/lib/assistant-navigation";

/** Legacy Vellum shell; Cadet deep links redirect to its fixed ingress domain. */

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

  if (requested !== "vellum") {
    return NextResponse.redirect(
      gatewayAssistantUrl(ASSISTANT_GATEWAY_ORIGIN, url.pathname + url.search),
      307,
    );
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
