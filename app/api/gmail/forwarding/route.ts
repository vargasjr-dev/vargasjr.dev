import { NextResponse } from "next/server";
import {
  createForwardingAddress,
  listForwardingAddresses,
} from "@/lib/gmail-auth";

function isAdmin(request: Request): boolean {
  const cookie = request.headers.get("cookie") ?? "";
  if (cookie.includes("admin_session=1")) return true;
  const token = request.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.ADMIN_TOKEN;
}

export async function GET(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json({
      forwardingAddresses: await listForwardingAddresses(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "failed to list forwarding addresses",
      },
      { status: 502 },
    );
  }
}

/** Triggers Google's verification email to the given address. */
export async function POST(request: Request) {
  if (!isAdmin(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { email } = await request.json().catch(() => ({}));
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return NextResponse.json(
      { error: "valid email required" },
      { status: 400 },
    );
  }
  try {
    await createForwardingAddress(email);
    return NextResponse.json({
      ok: true,
      note: `verification email sent to ${email} — VargasJR will confirm it from the inbox`,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof Error
            ? e.message
            : "failed to create forwarding address",
      },
      { status: 502 },
    );
  }
}
