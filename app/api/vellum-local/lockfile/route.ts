import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_session")?.value) {
    return new NextResponse(null, { status: 401 });
  }

  const token = process.env.VELLUM_ACCESS_TOKEN;
  if (!token) return new NextResponse(null, { status: 404 });

  const assistantId = process.env.VELLUM_ASSISTANT_ID;
  if (!assistantId) return new NextResponse(null, { status: 404 });

  // Use the request origin so the SPA talks back through vargasjr.dev's
  // proxy rewrites (/v1/*, /_allauth/*, /accounts/*) rather than directly
  // to the backend. VELLUM_API_URL is for the proxy destination only.
  const origin = new URL(request.url).origin;

  return NextResponse.json({
    assistants: [
      {
        assistantId,
        cloud: "docker",
        // resources.gatewayPort must be non-null for the SPA's I() filter to
        // include this assistant in the local list (D). Without it, D=[] and
        // the auto-connect P() never fires, leaving the SPA on "Connecting…".
        resources: { gatewayPort: "self-hosted" },
      },
    ],
    activeAssistant: assistantId,
    url: origin,
    token,
  });
}
