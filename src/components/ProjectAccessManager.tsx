"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Contractor = { id: number; name: string; email: string };

export default function ProjectAccessManager({
  projectId,
  allContractors,
  assignedIds,
}: {
  projectId: number;
  allContractors: Contractor[];
  assignedIds: number[];
}) {
  const router = useRouter();
  const [assigned, setAssigned] = useState<number[]>(assignedIds);
  const [loading, setLoading] = useState<number | null>(null);

  async function toggle(userId: number) {
    setLoading(userId);
    const isAssigned = assigned.includes(userId);
    const method = isAssigned ? "DELETE" : "POST";

    await fetch(`/api/projects/${projectId}/access`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });

    setAssigned((prev) =>
      isAssigned ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
    setLoading(null);
    router.refresh();
  }

  if (allContractors.length === 0) {
    return (
      <p className="text-sm text-gray-400">
        Brak wykonawców. <a href="/admin/users" className="text-blue-600 hover:underline">Dodaj wykonawcę</a>.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {allContractors.map((c) => {
        const isAssigned = assigned.includes(c.id);
        return (
          <div key={c.id} className="flex items-center justify-between py-1.5">
            <div>
              <p className="text-sm font-medium text-gray-900">{c.name}</p>
              <p className="text-xs text-gray-400">{c.email}</p>
            </div>
            <button
              onClick={() => toggle(c.id)}
              disabled={loading === c.id}
              className={`btn btn-sm ${
                isAssigned
                  ? "border-green-400 bg-green-50 text-green-700 hover:bg-red-50 hover:border-red-300 hover:text-red-600"
                  : "border-gray-300 bg-white text-gray-600 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600"
              }`}
            >
              {loading === c.id ? "..." : isAssigned ? "Przypisany ✓" : "Przypisz"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
