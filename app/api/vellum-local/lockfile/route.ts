import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  const cookieStore = await cookies();
  if (!cookieStore.get("admin_session")?.value) {
    return new NextResponse(null, { status: 401 });
  }

  const token = process.env.VELLUM_ACCESS_TOKEN;
  if (!token) return new NextResponse(null, { status: 404 });

  return NextResponse.json({
    assistants: [
      {
        assistantId: "vargasjr",
        cloud: "vellum",
      },
    ],
    activeAssistant: "vargasjr",
    url: process.env.VELLUM_API_URL ?? "",
    token,
  });
}
