import { NextResponse } from "next/server";

export async function GET() {
  const token = process.env.VELLUM_ACCESS_TOKEN;
  if (!token) return new NextResponse(null, { status: 404 });

  return NextResponse.json({ accessToken: token });
}
