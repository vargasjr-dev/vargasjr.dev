import { NextResponse } from "next/server";
import { db } from "@/db";
import { velcroCustomerAccounts } from "@/db/schema";

function isAuthorized(request: Request): boolean {
  return request.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}

// POST /api/admin/velcro/accounts — attach a contact channel (account) to a customer.
// channel is free-form (email, sms, phone, github, x, ...) and handle is the
// customer's identifier on that channel.
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const customerId: unknown = body.customerId;
  const channel: unknown = body.channel;
  const handle: unknown = body.handle;

  if (
    typeof customerId !== "number" ||
    !Number.isInteger(customerId) ||
    customerId <= 0
  ) {
    return NextResponse.json(
      { error: "customerId is required" },
      { status: 400 },
    );
  }
  if (
    typeof channel !== "string" ||
    channel.trim().length === 0 ||
    channel.length > 32
  ) {
    return NextResponse.json(
      { error: "channel is required (max 32 chars)" },
      { status: 400 },
    );
  }
  if (
    typeof handle !== "string" ||
    handle.trim().length === 0 ||
    handle.length > 256
  ) {
    return NextResponse.json(
      { error: "handle is required (max 256 chars)" },
      { status: 400 },
    );
  }

  try {
    const [account] = await db
      .insert(velcroCustomerAccounts)
      .values({
        customerId,
        channel: channel.trim().toLowerCase(),
        handle: handle.trim(),
      })
      .returning();
    return NextResponse.json({ account });
  } catch {
    // Unique index on (channel, handle): the same person can't be attached
    // to the same channel twice.
    return NextResponse.json(
      { error: "An account with that channel and handle already exists" },
      { status: 409 },
    );
  }
}
