import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  velcroCaseEvents,
  velcroCaseLinks,
  velcroCases,
  velcroCustomers,
} from "@/db/schema";

function isAuthorized(request: Request): boolean {
  return request.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}

// GET /api/admin/velcro/cases/[id] — one case with its full history and links.
export async function GET(
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

  const [velcroCase] = await db
    .select({
      id: velcroCases.id,
      title: velcroCases.title,
      priority: velcroCases.priority,
      status: velcroCases.status,
      customerId: velcroCases.customerId,
      customerName: velcroCustomers.name,
      blockedOn: velcroCases.blockedOn,
      createdAt: velcroCases.createdAt,
      closedAt: velcroCases.closedAt,
    })
    .from(velcroCases)
    .leftJoin(velcroCustomers, eq(velcroCases.customerId, velcroCustomers.id))
    .where(eq(velcroCases.id, caseId))
    .limit(1);

  if (!velcroCase) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const events = await db
    .select()
    .from(velcroCaseEvents)
    .where(eq(velcroCaseEvents.caseId, caseId))
    .orderBy(asc(velcroCaseEvents.createdAt), asc(velcroCaseEvents.id));

  const links = await db
    .select()
    .from(velcroCaseLinks)
    .where(eq(velcroCaseLinks.caseId, caseId))
    .orderBy(asc(velcroCaseLinks.createdAt), asc(velcroCaseLinks.id));

  return NextResponse.json({ case: velcroCase, events, links });
}

// PATCH /api/admin/velcro/cases/[id] — manual edits: title, priority (0-100),
// blockedOn, customer, and open/close. Closing sets closedAt; reopening
// clears it. Everything here is manual — no automation.
export async function PATCH(
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
  const title: unknown = body.title;
  const priority: unknown = body.priority;
  const blockedOn: unknown = body.blockedOn;
  const customerId: unknown = body.customerId;
  const status: unknown = body.status;

  if (title !== undefined) {
    if (
      typeof title !== "string" ||
      title.trim().length === 0 ||
      title.length > 500
    ) {
      return NextResponse.json(
        {
          error: "title must be a non-empty string of 500 characters or fewer",
        },
        { status: 400 },
      );
    }
  }
  if (priority !== undefined) {
    if (
      typeof priority !== "number" ||
      !Number.isInteger(priority) ||
      priority < 0 ||
      priority > 100
    ) {
      return NextResponse.json(
        { error: "priority must be an integer from 0 to 100" },
        { status: 400 },
      );
    }
  }
  if (
    blockedOn !== undefined &&
    blockedOn !== null &&
    typeof blockedOn !== "string"
  ) {
    return NextResponse.json(
      { error: "blockedOn must be a string" },
      { status: 400 },
    );
  }
  if (
    customerId !== undefined &&
    customerId !== null &&
    (typeof customerId !== "number" ||
      !Number.isInteger(customerId) ||
      customerId <= 0)
  ) {
    return NextResponse.json({ error: "invalid customerId" }, { status: 400 });
  }
  if (status !== undefined && status !== "open" && status !== "closed") {
    return NextResponse.json(
      { error: "status must be 'open' or 'closed'" },
      { status: 400 },
    );
  }

  const updates: {
    title?: string;
    priority?: number;
    blockedOn?: string | null;
    customerId?: number | null;
    status?: string;
    closedAt?: Date | null;
  } = {};
  if (title !== undefined) updates.title = title.trim();
  if (priority !== undefined) updates.priority = priority;
  if (blockedOn !== undefined)
    updates.blockedOn = typeof blockedOn === "string" ? blockedOn : null;
  if (customerId !== undefined) updates.customerId = customerId ?? null;
  if (status !== undefined) {
    updates.status = status;
    updates.closedAt = status === "closed" ? new Date() : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const [updated] = await db
    .update(velcroCases)
    .set(updates)
    .where(eq(velcroCases.id, caseId))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }
  return NextResponse.json({ case: updated });
}
