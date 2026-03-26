"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteProjectButton({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-600">Usunąć projekt?</span>
        <button onClick={handleDelete} disabled={loading} className="btn btn-sm bg-red-600 hover:bg-red-700 text-white border-red-600">
          {loading ? "Usuwanie…" : "Tak, usuń"}
        </button>
        <button onClick={() => setConfirming(false)} className="btn btn-secondary btn-sm">Anuluj</button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)} className="btn btn-secondary btn-sm text-red-600 hover:border-red-300 hover:bg-red-50">
      Usuń projekt
    </button>
  );
}
