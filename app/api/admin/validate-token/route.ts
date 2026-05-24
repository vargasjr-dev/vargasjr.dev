import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { token } = await request.json();
  if (!token || token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({ valid: false }, { status: 401 });
  }
  return NextResponse.json({ valid: true });
}
