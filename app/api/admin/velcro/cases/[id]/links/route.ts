import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { velcroCaseLinks, velcroCases } from "@/db/schema";

function isAuthorized(request: Request): boolean {
  return request.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}

async function caseExists(caseId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: velcroCases.id })
    .from(velcroCases)
    .where(eq(velcroCases.id, caseId))
    .limit(1);
  return row !== undefined;
}

// POST /api/admin/velcro/cases/[id]/links — attach a related link to a case.
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
  const url: unknown = body.url;
  const label: unknown = body.label;

  if (typeof url !== "string" || !/^https?:\/\/\S+$/.test(url.trim())) {
    return NextResponse.json(
      { error: "url must be an http(s) URL" },
      { status: 400 },
    );
  }
  if (
    label !== undefined &&
    label !== null &&
    (typeof label !== "string" || label.length > 256)
  ) {
    return NextResponse.json(
      { error: "label must be a string of 256 characters or fewer" },
      { status: 400 },
    );
  }
  if (!(await caseExists(caseId))) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const [link] = await db
    .insert(velcroCaseLinks)
    .values({
      caseId,
      url: url.trim(),
      label: typeof label === "string" ? label.trim() || null : null,
    })
    .returning();

  return NextResponse.json({ link });
}

// DELETE /api/admin/velcro/cases/[id]/links?linkId=N — remove a link.
export async function DELETE(
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

  const linkId = Number(new URL(request.url).searchParams.get("linkId") ?? "");
  if (!Number.isInteger(linkId) || linkId <= 0) {
    return NextResponse.json(
      { error: "linkId query param is required" },
      { status: 400 },
    );
  }

  const [link] = await db
    .delete(velcroCaseLinks)
    .where(
      and(eq(velcroCaseLinks.id, linkId), eq(velcroCaseLinks.caseId, caseId)),
    )
    .returning();

  if (!link) {
    return NextResponse.json({ error: "Link not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
