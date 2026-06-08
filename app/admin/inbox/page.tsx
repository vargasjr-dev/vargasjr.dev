import { db } from "@/db";
import { emails } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";

const ACCOUNTS = ["vargas@vargasjr.dev", "hello@vargasjr.dev"] as const;
type Account = (typeof ACCOUNTS)[number];

async function getEmails(account: Account) {
  return db
    .select()
    .from(emails)
    .where(eq(emails.to, account))
    .orderBy(desc(emails.receivedAt))
    .limit(50);
}

function formatDate(d: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(d));
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ account?: string }>;
}) {
  const { account: rawAccount } = await searchParams;
  const account: Account = ACCOUNTS.includes(rawAccount as Account)
    ? (rawAccount as Account)
    : ACCOUNTS[0];

  const rows = await getEmails(account);

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Inbox</h1>
          <Link
            href="/admin"
            className="text-sm text-gray-500 hover:text-gray-300"
          >
            ← Admin
          </Link>
        </div>

        {/* Account switcher */}
        <div className="flex gap-2 mb-6">
          {ACCOUNTS.map((a) => (
            <Link
              key={a}
              href={`/admin/inbox?account=${encodeURIComponent(a)}`}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                a === account
                  ? "bg-[#3ba4dc] text-white"
                  : "bg-gray-800 text-gray-400 hover:bg-gray-700"
              }`}
            >
              {a.split("@")[0]}
            </Link>
          ))}
        </div>

        {/* Email list */}
        {rows.length === 0 ? (
          <div className="text-center py-24 text-gray-500">
            <p className="text-lg">No emails yet</p>
            <p className="text-sm mt-1">{account}</p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-800">
            {rows.map((email) => (
              <li key={email.id}>
                <a
                  href={
                    email.blobKey
                      ? `/api/resend/email?key=${encodeURIComponent(email.blobKey)}`
                      : "#"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block px-4 py-4 hover:bg-gray-900 rounded-lg transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-300 truncate">
                        {email.from}
                      </p>
                      <p className="text-base font-semibold text-white truncate mt-0.5">
                        {email.subject || "(no subject)"}
                      </p>
                      {email.preview && (
                        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                          {email.preview}
                        </p>
                      )}
                    </div>
                    <time className="text-xs text-gray-500 whitespace-nowrap mt-1">
                      {formatDate(email.receivedAt)}
                    </time>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
