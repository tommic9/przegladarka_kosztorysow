"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const links = [
  {
    href: "/contractor",
    label: "Moje projekty",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    ),
  },
  {
    href: "/contractor/rozliczenia",
    label: "Rozliczenia",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <line x1="2" y1="10" x2="22" y2="10"/>
      </svg>
    ),
  },
];

export default function ContractorNav({ userName }: { userName: string }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <nav className="no-print bg-slate-900 border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
        {/* Brand + links */}
        <div className="flex items-center gap-4 min-w-0">
          <span className="font-heading font-bold text-white text-sm tracking-widest shrink-0 hidden sm:block">
            KOSZTORYSY
          </span>
          <div className="h-4 w-px bg-slate-700 hidden sm:block shrink-0" />
          <div className="flex gap-1 overflow-x-auto">
            {links.map((l) => {
              const isActive = pathname === l.href;
              return (
                <Link key={l.href} href={l.href}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                    isActive ? "text-amber-400 bg-white/10" : "text-slate-200 hover:text-white hover:bg-white/10"
                  }`}
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
          <span className="text-xs text-slate-300 hidden md:block truncate max-w-[160px]">{userName}</span>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors text-slate-200 hover:text-white border border-slate-600 hover:border-slate-400"
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
