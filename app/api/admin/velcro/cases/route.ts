import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  velcroActivityItems,
  velcroCaseEvents,
  velcroCases,
  velcroCustomers,
} from "@/db/schema";

function isAuthorized(request: Request): boolean {
  return request.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}

// GET /api/admin/velcro/cases — list cases, newest first, with customer names.
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cases = await db
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
    .orderBy(desc(velcroCases.createdAt), desc(velcroCases.id));

  return NextResponse.json({ cases });
}

// POST /api/admin/velcro/cases — create a case manually. When activityItemId
// is provided, the case is seeded from that activity item (title, customer,
// and an opening note with the item's body).
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const title: unknown = body.title;
  const priority: unknown = body.priority ?? 50;
  const customerId: unknown = body.customerId;
  const blockedOn: unknown = body.blockedOn;
  const activityItemId: unknown = body.activityItemId;

  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (title.length > 500) {
    return NextResponse.json(
      { error: "title must be 500 characters or fewer" },
      { status: 400 },
    );
  }
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
  if (
    customerId !== undefined &&
    customerId !== null &&
    (typeof customerId !== "number" ||
      !Number.isInteger(customerId) ||
      customerId <= 0)
  ) {
    return NextResponse.json({ error: "invalid customerId" }, { status: 400 });
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
    activityItemId !== undefined &&
    activityItemId !== null &&
    (typeof activityItemId !== "number" ||
      !Number.isInteger(activityItemId) ||
      activityItemId <= 0)
  ) {
    return NextResponse.json(
      { error: "invalid activityItemId" },
      { status: 400 },
    );
  }

  // Seeding from an activity item: pull in its customer and body (as the
  // opening note). Missing items are ignored rather than failing the create.
  let seed: { body: string | null; customerId: number | null } | null = null;
  if (activityItemId !== undefined && activityItemId !== null) {
    const [item] = await db
      .select()
      .from(velcroActivityItems)
      .where(eq(velcroActivityItems.id, activityItemId))
      .limit(1);
    if (item) {
      seed = { body: item.body, customerId: item.customerId };
    }
  }

  const [created] = await db
    .insert(velcroCases)
    .values({
      title: title.trim(),
      priority,
      customerId:
        customerId !== undefined && customerId !== null
          ? customerId
          : (seed?.customerId ?? null),
      blockedOn: typeof blockedOn === "string" ? blockedOn : null,
    })
    .returning();

  const seedBody = seed?.body;
  if (activityItemId !== undefined && activityItemId !== null && seedBody) {
    await db.insert(velcroCaseEvents).values({
      caseId: created.id,
      kind: "note",
      body: seedBody,
    });
  }

  return NextResponse.json({ case: created });
}
