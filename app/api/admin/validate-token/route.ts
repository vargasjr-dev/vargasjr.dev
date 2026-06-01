import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { token } = await request.json();
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
  const res = NextResponse.json({ valid: true });
  res.cookies.set("admin_session", "1", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 1 week
    path: "/",
  });
  return res;
}
