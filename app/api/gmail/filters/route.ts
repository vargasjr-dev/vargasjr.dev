import { NextResponse } from "next/server";
import {
  createGmailFilter,
  deleteGmailFilter,
  listGmailFilters,
} from "@/lib/gmail-auth";

function isAdmin(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  if (cookie.includes("admin_session=1")) return true;
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.ADMIN_TOKEN;
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({ filters: await listGmailFilters() });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to list filters" },
      { status: 502 },
    );
  }
}

export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const body = await request.json();
    const { from, subject, query } = body ?? {};
    const forwardTo = body?.forwardTo;
    if (!from && !subject && !query) {
      return NextResponse.json(
        { error: "at least one of from / subject / query is required" },
        { status: 400 },
      );
    }
    if (forwardTo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(forwardTo)) {
      return NextResponse.json({ error: "invalid forwardTo address" }, { status: 400 });
    }

    const filter = await createGmailFilter({
      criteria: {
        ...(from ? { from } : {}),
        ...(subject ? { subject } : {}),
        ...(query ? { query } : {}),
      },
      action: {
        ...(forwardTo ? { forwardTo } : {}),
      },
    });
    return NextResponse.json({ filter });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to create filter" },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  try {
    await deleteGmailFilter(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to delete filter" },
      { status: 502 },
    );
  }
}
