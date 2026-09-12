import { NextResponse } from "next/server";
import {
  createGmailFilter,
  deleteGmailFilter,
  findOrCreateVargasJrLabel,
  listGmailFilters,
} from "@/lib/gmail-auth";

/** All filters we manage forward to this address — anything else belongs to
 *  Vargas's personal Gmail and must never be shown or touched from here. */
const MANAGED_FORWARD_TO = "hello@vargasjr.dev";

function isManaged(filter: {
  action?: { forward?: string; forwardTo?: string };
}): boolean {
  return (
    filter.action?.forward?.toLowerCase() === MANAGED_FORWARD_TO ||
    filter.action?.forwardTo?.toLowerCase() === MANAGED_FORWARD_TO
  );
}

function isAdmin(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  if (cookie.includes("admin_session=1")) return true;
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.ADMIN_TOKEN;
}

const PAGE_SIZE = 10;

/** Sort key: the domain of the from address (b@a.com before a@b.com).
 *  Filters without a from criterion sort to the end. */
function sortKey(filter: {
  criteria?: { from?: string; query?: string };
}): string {
  const from = filter.criteria?.from?.trim();
  if (!from) return "\uffff";
  const first = from.split(/[\s,;]+/)[0] ?? "";
  const domain = first.split("@").pop() ?? "";
  return domain.toLowerCase() || "\uffff";
}

function compareFilters(
  a: { criteria?: { from?: string; query?: string } },
  b: { criteria?: { from?: string; query?: string } },
): number {
  return (
    sortKey(a).localeCompare(sortKey(b)) ||
    (a.criteria?.from ?? "").localeCompare(b.criteria?.from ?? "")
  );
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const managed = (await listGmailFilters()).filter(isManaged);
    managed.sort(compareFilters);
    const totalPages = Math.max(1, Math.ceil(managed.length / PAGE_SIZE));
    const url = new URL(request.url);
    const page = Math.min(
      Math.max(1, Number(url.searchParams.get("page")) || 1),
      totalPages,
    );
    const slice = managed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return NextResponse.json({
      filters: slice,
      total: managed.length,
      page,
      pageSize: PAGE_SIZE,
      totalPages,
    });
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
      return NextResponse.json(
        { error: "invalid forwardTo address" },
        { status: 400 },
      );
    }

    // Attach the VargasJR label if the token has the labels scope; the
    // filter still works (forward/archive/read) without it.
    let labelWarning: string | null = null;
    let labelId: string | null = null;
    try {
      labelId = await findOrCreateVargasJrLabel();
    } catch {
      labelWarning =
        "label not attached — reconnect on /admin/gmail to grant the gmail.labels scope";
    }

    const filter = await createGmailFilter({
      criteria: {
        ...(from ? { from } : {}),
        ...(subject ? { subject } : {}),
        ...(query ? { query } : {}),
      },
      action: {
        ...(forwardTo ? { forwardTo } : {}),
        ...(labelId ? { addLabelIds: [labelId] } : {}),
        // archive (remove from INBOX) + mark as read (remove UNREAD)
        removeLabelIds: ["INBOX", "UNREAD"],
      },
    });
    return NextResponse.json({ filter, warning: labelWarning });
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
    const all = await listGmailFilters();
    const target = all.find((f) => f.id === id);
    if (!target || !isManaged(target)) {
      return NextResponse.json(
        { error: "not a VargasJR-managed filter" },
        { status: 403 },
      );
    }
    await deleteGmailFilter(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "failed to delete filter" },
      { status: 502 },
    );
  }
}
