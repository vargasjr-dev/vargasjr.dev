import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { velcroCaseEvents, velcroCases } from "@/db/schema";

function isAuthorized(request: Request): boolean {
  return request.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}

// POST /api/admin/velcro/cases/[id]/events — append a note or action to the
// case's history. History is append-only: events are never edited or deleted.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const caseId = Number(id);
  if (!Number.isInteger(caseId) || caseId <= 0) {
    return NextResponse.json({ error: "Invalid case id" }, { status: 400 });
  }

  const body = await request.json();
  const kind: unknown = body.kind ?? "note";
  const eventBody: unknown = body.body;

  if (kind !== "note" && kind !== "action") {
    return NextResponse.json(
      { error: "kind must be 'note' or 'action'" },
      { status: 400 },
    );
  }
  if (typeof eventBody !== "string" || eventBody.trim().length === 0) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  const [velcroCase] = await db
    .select({ id: velcroCases.id })
    .from(velcroCases)
    .where(eq(velcroCases.id, caseId))
    .limit(1);
  if (!velcroCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const [event] = await db
    .insert(velcroCaseEvents)
    .values({ caseId, kind, body: eventBody.trim() })
    .returning();

  return NextResponse.json({ event });
}

// Events are append-only; no GET list endpoint — the case detail route
// (/api/admin/velcro/cases/[id]) returns the full history.
