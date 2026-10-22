import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { velcroActivityItems, velcroCustomers } from "@/db/schema";

function isAuthorized(request: Request): boolean {
  return request.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}

// GET /api/admin/velcro/activity — list activity items, newest first.
// ?unread=1 filters to items that haven't been marked as read yet.
// This is a thin shell for v1 — no ingestion machinery; items arrive manually
// (or later via other Velcro flows) and will be refactored once Vellum's
// Velcro source code is available.
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const unreadOnly = new URL(request.url).searchParams.get("unread") === "1";

  const items = await db
    .select({
      id: velcroActivityItems.id,
      source: velcroActivityItems.source,
      externalId: velcroActivityItems.externalId,
      title: velcroActivityItems.title,
      body: velcroActivityItems.body,
      customerId: velcroActivityItems.customerId,
      customerName: velcroCustomers.name,
      readAt: velcroActivityItems.readAt,
      createdAt: velcroActivityItems.createdAt,
    })
    .from(velcroActivityItems)
    .leftJoin(
      velcroCustomers,
      eq(velcroActivityItems.customerId, velcroCustomers.id),
    )
    .orderBy(desc(velcroActivityItems.createdAt), desc(velcroActivityItems.id))
    .limit(200);

  return NextResponse.json({
    items: unreadOnly ? items.filter((item) => item.readAt === null) : items,
  });
}

// POST /api/admin/velcro/activity — manually add an activity item.
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const title: unknown = body.title;
  const itemBody: unknown = body.body;
  const customerId: unknown = body.customerId;

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
    itemBody !== undefined &&
    itemBody !== null &&
    typeof itemBody !== "string"
  ) {
    return NextResponse.json(
      { error: "body must be a string" },
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

  const [item] = await db
    .insert(velcroActivityItems)
    .values({
      source: "manual",
      title: title.trim(),
      body: typeof itemBody === "string" ? itemBody : null,
      customerId: customerId ?? null,
    })
    .returning();

  return NextResponse.json({ item });
}
