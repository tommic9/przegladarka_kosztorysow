"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

export default function AdminNav({ userName }: { userName: string }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const links = [
    { href: "/admin", label: "Projekty" },
    { href: "/admin/users", label: "Wykonawcy" },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 no-print">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-gray-900">Panel admina</span>
          <div className="flex gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname === l.href
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{userName}</span>
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">
            Wyloguj
          </button>
        </div>
      </div>
    </nav>
  );
}
