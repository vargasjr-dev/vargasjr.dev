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
    return NextResponse.json(
      { error: "Plaid credentials not configured" },
      { status: 500 },
    );
  }

  const res = await fetch("https://production.plaid.com/link/token/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      secret,
      client_name: "VargasJR Sunday Fundsday",
      user: { client_user_id: "vargas-dvargas92495" },
      products: ["transactions"],
      country_codes: ["US"],
      language: "en",
    }),
  });

  const data = await res.json();
  return NextResponse.json(data, { status: res.ok ? 200 : 400 });
}
