import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { velcroCustomerAccounts, velcroCustomers } from "@/db/schema";

function isAuthorized(request: Request): boolean {
  return request.headers.get("x-admin-token") === process.env.ADMIN_TOKEN;
}

// GET /api/admin/velcro/customers — list customers (people) with their accounts.
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const customers = await db
    .select()
    .from(velcroCustomers)
    .orderBy(asc(velcroCustomers.name), asc(velcroCustomers.id));

  const accounts = await db
    .select()
    .from(velcroCustomerAccounts)
    .orderBy(asc(velcroCustomerAccounts.id));

  const accountsByCustomer = new Map<number, typeof accounts>();
  for (const account of accounts) {
    const list = accountsByCustomer.get(account.customerId) ?? [];
    list.push(account);
    accountsByCustomer.set(account.customerId, list);
  }

  return NextResponse.json({
    customers: customers.map((customer) => ({
      ...customer,
      accounts: accountsByCustomer.get(customer.id) ?? [],
    })),
  });
}

// POST /api/admin/velcro/customers — create a customer. Customers are people
// only for now (Vargas's ruling) — name is the person's name.
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name: unknown = body.name;
  const notes: unknown = body.notes;

  if (typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (name.trim().length > 128) {
    return NextResponse.json(
      { error: "name must be 128 characters or fewer" },
      { status: 400 },
    );
  }
  if (notes !== undefined && notes !== null && typeof notes !== "string") {
    return NextResponse.json(
      { error: "notes must be a string" },
      { status: 400 },
    );
  }

  const [customer] = await db
    .insert(velcroCustomers)
    .values({
      name: name.trim(),
      notes: typeof notes === "string" ? notes : null,
    })
    .returning();

  return NextResponse.json({ customer: { ...customer, accounts: [] } });
}
