import { NextResponse } from "next/server";

function checkAuth(request: Request): boolean {
  const token = request.headers.get("x-admin-token");
  return token === process.env.ADMIN_TOKEN;
}

export async function POST(request: Request) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;

  if (!clientId || !secret) {
    return NextResponse.json({ error: "Plaid credentials not configured" }, { status: 500 });
  }

  const { public_token } = await request.json();
  if (!public_token) {
    return NextResponse.json({ error: "Missing public_token" }, { status: 400 });
  }

  const res = await fetch("https://production.plaid.com/item/public_token/exchange", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, secret, public_token }),
  });

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    return NextResponse.json(data, { status: 400 });
  }

  return NextResponse.json({ success: true, item_id: data.item_id, access_token: data.access_token });
}
