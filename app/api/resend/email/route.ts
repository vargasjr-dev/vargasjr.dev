import { NextRequest, NextResponse } from "next/server";
import { head } from "@vercel/blob";

export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return NextResponse.json({ error: "missing key" }, { status: 400 });

  // Fetch blob metadata to get the URL, then redirect
  try {
    const blob = await head(key);
    return NextResponse.redirect(blob.url);
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
