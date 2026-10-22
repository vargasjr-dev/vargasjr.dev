"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Cases are the heart of the dashboard, so they lead the tabs; activity is a
// thin shell for now.
const TABS = [
  { href: "/admin/velcro/cases", label: "Cases" },
  { href: "/admin/velcro/activity", label: "Activity" },
  { href: "/admin/velcro/customers", label: "Customers" },
];

export default function VelcroLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="mx-auto max-w-4xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#3ba4dc]">🧲 Velcro</h1>
            <p className="text-gray-400 text-sm">
              Customer operations — everything manual, cases first.
            </p>
          </div>
          <Link
            href="/admin"
            className="text-gray-400 hover:text-gray-200 text-sm"
          >
            ← Admin
          </Link>
        </div>
        <nav className="flex gap-2 mb-6">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[#3ba4dc] text-white"
                    : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        {children}
      </div>
    </main>
  );
}
