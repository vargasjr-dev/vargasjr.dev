// Shared client plumbing for the Velcro admin pages: every call attaches the
// admin token, and a 401 bounces back to /admin (session lost).

export type VelcroCustomerAccount = {
  id: number;
  customerId: number;
  channel: string;
  handle: string;
  createdAt: string;
};

export type VelcroCustomer = {
  id: number;
  name: string;
  notes: string | null;
  createdAt: string;
  accounts: VelcroCustomerAccount[];
};

export type VelcroCase = {
  id: number;
  title: string;
  priority: number;
  status: string;
  customerId: number | null;
  customerName: string | null;
  blockedOn: string | null;
  createdAt: string;
  closedAt: string | null;
};

export type VelcroCaseEvent = {
  id: number;
  caseId: number;
  kind: string;
  body: string;
  createdAt: string;
};

export type VelcroCaseLink = {
  id: number;
  caseId: number;
  url: string;
  label: string | null;
  createdAt: string;
};

export type VelcroActivityItem = {
  id: number;
  source: string;
  externalId: string | null;
  title: string;
  body: string | null;
  customerId: number | null;
  customerName: string | null;
  readAt: string | null;
  createdAt: string;
};

// Returns the Response, or null when the session bounced (401 → /admin).
export async function velcroFetch(
  path: string,
  init?: RequestInit,
): Promise<Response | null> {
  const adminToken = localStorage.getItem("admin_token") ?? "";
  const res = await fetch(`/api/admin/velcro/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-admin-token": adminToken,
      ...init?.headers,
    },
  });
  if (res.status === 401) {
    window.location.href = "/admin";
    return null;
  }
  return res;
}
