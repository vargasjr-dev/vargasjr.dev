import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { velcroActivityItems } from "@/db/schema";

function isAuthorized(request: Request): boolean {
  return request.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}

// PATCH /api/admin/velcro/activity/[id] — mark an item as read or unread.
// { read: true } stamps readAt; { read: false } clears it.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const body = await request.json();
  if (typeof body.read !== "boolean") {
    return NextResponse.json(
      { error: "read must be a boolean" },
      { status: 400 },
    );
  }

  const [item] = await db
    .update(velcroActivityItems)
    .set({ readAt: body.read ? new Date() : null })
    .where(eq(velcroActivityItems.id, itemId))
    .returning();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  return NextResponse.json({ item });
}

// DELETE /api/admin/velcro/activity/[id] — remove an activity item.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const itemId = Number(id);
  if (!Number.isInteger(itemId) || itemId <= 0) {
    return NextResponse.json({ error: "Invalid item id" }, { status: 400 });
  }

  const [item] = await db
    .delete(velcroActivityItems)
    .where(eq(velcroActivityItems.id, itemId))
    .returning();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
