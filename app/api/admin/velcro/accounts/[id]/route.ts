import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { velcroCustomerAccounts } from "@/db/schema";

function isAuthorized(request: Request): boolean {
  return request.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}

// DELETE /api/admin/velcro/accounts/[id] — remove a customer's contact channel.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const accountId = Number(id);
  if (!Number.isInteger(accountId) || accountId <= 0) {
    return NextResponse.json({ error: "Invalid account id" }, { status: 400 });
  }

  const [account] = await db
    .delete(velcroCustomerAccounts)
    .where(eq(velcroCustomerAccounts.id, accountId))
    .returning();

  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
