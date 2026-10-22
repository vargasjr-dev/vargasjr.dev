import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { velcroCustomers } from "@/db/schema";

function isAuthorized(request: Request): boolean {
  return request.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}

// PATCH /api/admin/velcro/customers/[id] — edit a customer's name and/or notes.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId) || customerId <= 0) {
    return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
  }

  const body = await request.json();
  const name: unknown = body.name;
  const notes: unknown = body.notes;

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "name must be a non-empty string" },
        { status: 400 },
      );
    }
    if (name.trim().length > 128) {
      return NextResponse.json(
        { error: "name must be 128 characters or fewer" },
        { status: 400 },
      );
    }
  }
  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    return NextResponse.json(
      { error: "notes must be a string" },
      { status: 400 },
    );
  }

  if (name === undefined && notes === undefined) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const updates: { name?: string; notes?: string | null } = {};
  if (typeof name === "string") updates.name = name.trim();
  if (notes !== undefined)
    updates.notes = typeof notes === "string" ? notes : null;

  const [customer] = await db
    .update(velcroCustomers)
    .set(updates)
    .where(eq(velcroCustomers.id, customerId))
    .returning();

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  return NextResponse.json({ customer });
}

// DELETE /api/admin/velcro/customers/[id] — remove a customer. Accounts
// cascade; cases and activity items keep their rows with a null customer.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId) || customerId <= 0) {
    return NextResponse.json({ error: "Invalid customer id" }, { status: 400 });
  }

  const [customer] = await db
    .delete(velcroCustomers)
    .where(eq(velcroCustomers.id, customerId))
    .returning();

  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
