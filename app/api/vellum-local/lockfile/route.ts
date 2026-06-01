import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_session")?.value) {
    return new NextResponse(null, { status: 401 });
  }

  const token = process.env.VELLUM_ACCESS_TOKEN;
  if (!token) return new NextResponse(null, { status: 404 });

  // Use the request origin so the SPA talks back through vargasjr.dev's
  // proxy rewrites (/v1/*, /_allauth/*, /accounts/*) rather than directly
  // to the backend. VELLUM_API_URL is for the proxy destination only.
  const origin = new URL(request.url).origin;

  return NextResponse.json({
    assistants: [
      {
        assistantId: "vargasjr",
        cloud: "docker",
      },
    ],
    activeAssistant: "vargasjr",
    url: origin,
    token,
  });
}
