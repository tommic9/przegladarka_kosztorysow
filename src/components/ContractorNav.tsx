"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

export default function ContractorNav({ userName }: { userName: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <nav className="bg-white border-b border-gray-200 no-print">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/contractor" className="font-semibold text-gray-900">
            Moje projekty
          </Link>
          <Link href="/contractor/rozliczenia" className="text-sm text-gray-500 hover:text-gray-900">
            Rozliczenia
          </Link>
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
