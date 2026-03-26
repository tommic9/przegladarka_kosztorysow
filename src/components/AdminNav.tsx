"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";

const links = [
  {
    href: "/admin",
    label: "Projekty",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    href: "/admin/users",
    label: "Wykonawcy",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
  },
];

export default function AdminNav({ userName }: { userName: string }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <nav className="no-print" style={{ background: "var(--nav-bg)", borderBottom: "1px solid var(--nav-border)" }}>
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Brand + links */}
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-heading font-bold text-white text-sm tracking-widest shrink-0 hidden sm:block">
            KOSZTORYSY
          </span>
          <div className="h-4 w-px bg-slate-600 hidden sm:block shrink-0" />
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {links.map((l) => {
              const isActive = pathname === l.href || (l.href !== "/admin" && pathname.startsWith(l.href));
              return (
                <Link key={l.href} href={l.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive
                      ? "text-amber-400 bg-white/10"
                      : "text-slate-300 hover:text-white hover:bg-white/8"
                  }`}
                  style={isActive ? { background: "rgba(255,255,255,0.1)" } : {}}
                >
                  {l.icon}
                  <span>{l.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* User + logout */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-slate-400 hidden md:block truncate max-w-[160px]">{userName}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors text-slate-300 hover:text-white"
            style={{ border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span className="hidden sm:inline">Wyloguj</span>
          </button>
        </div>
      </div>
    </nav>
  );
}
