import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logHandshake } from "@/lib/handshake-log";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_session")?.value) {
    logHandshake({
      route: "lockfile",
      method: "GET",
      status: 401,
      detail: "no admin_session cookie",
    });
    return new NextResponse(null, { status: 401 });
  }

  const token = process.env.VELLUM_ACCESS_TOKEN;
  if (!token) {
    logHandshake({
      route: "lockfile",
      method: "GET",
      status: 404,
      detail: "VELLUM_ACCESS_TOKEN not set",
    });
    return new NextResponse(null, { status: 404 });
  }

  const assistantId = process.env.VELLUM_ASSISTANT_ID;
  if (!assistantId) {
    logHandshake({
      route: "lockfile",
      method: "GET",
      status: 404,
      detail: "VELLUM_ASSISTANT_ID not set",
    });
    return new NextResponse(null, { status: 404 });
  }

  // Use the request origin so the SPA talks back through vargasjr.dev's
  // proxy rewrites (/v1/*, /_allauth/*, /accounts/*) rather than directly
  // to the backend. VELLUM_API_URL is for the proxy destination only.
  const origin = new URL(request.url).origin;

  // @vellumai/web 0.10.x changed two things that affect this lockfile:
  //
  // 1. Local-mode cloud check is `cloud === 'local'` (was `cloud !== 'vellum'`).
  //    Omitting `cloud` lets `Lo()` in local-mode.js derive it as `'local'`
  //    (fallback chain: cloud → project/gcp → sshUser/custom → 'local').
  //    Setting `cloud: "docker"` (as we did in 0.8.x) makes `xs()` return false,
  //    which fails `ks()` (can-connect), which makes `As()` return null, which
  //    makes `oe()` (local-mode-ready) return false — so initSession never
  //    tries the local-mode connect and falls through to platform allauth.
  //
  // 2. The resources schema (Ro) in 0.10.0 uses a Zod `ZodNumber` validator
  //    for `gatewayPort` + `daemonPort`. If we send a string sentinel like
  //    `"self-hosted"`, Ro.safeParse() fails and `Vo()` silently drops the
  //    entire `resources` field — leaving the assistant with no gatewayPort,
  //    breaking `As()` again. Numeric values pass validation and become the
  //    URL path segment `/assistant/__gateway/${gatewayPort}`.
  //
  // Using `7830` (the Vellum gateway port the ngrok tunnel forwards to) lets
  // the SPA build `/assistant/__gateway/7830/v1/...` and the rewrite in
  // next.config.ts proxies that path to ${VELLUM_API_URL}/v1/... → ngrok.
  logHandshake({
    route: "lockfile",
    method: "GET",
    status: 200,
    detail: `assistantId=${assistantId} origin=${origin} tokenPresent=${!!token}`,
  });
  return NextResponse.json({
    assistants: [
      {
        assistantId,
        // cloud: "local" required — xs() in local-mode.js checks this field.
        // Without it, ks() returns false and the handshake never fires.
        cloud: "local",
        resources: { gatewayPort: 7830, daemonPort: 7830 },
      },
    ],
    activeAssistant: assistantId,
    url: origin,
    token,
  });
}
