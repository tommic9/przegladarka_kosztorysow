"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function AddVersionForm({ projectId }: { projectId: number }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [estimateFile, setEstimateFile] = useState<File | null>(null);
  const [materialsFile, setMaterialsFile] = useState<File | null>(null);
  const [athFile, setAthFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const estRef = useRef<HTMLInputElement>(null);
  const matRef = useRef<HTMLInputElement>(null);
  const athRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!estimateFile && !materialsFile && !athFile) {
      setError("Dodaj co najmniej jeden plik");
      return;
    }
    setError("");
    setLoading(true);

    const fd = new FormData();
    if (notes) fd.append("notes", notes);
    if (athFile) {
      fd.append("ath", athFile);
    } else {
      if (estimateFile) fd.append("estimate", estimateFile);
      if (materialsFile) fd.append("materials", materialsFile);
    }

    try {
      const res = await fetch(`/api/projects/${projectId}/versions`, { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Błąd"); return; }
      setNotes(""); setEstimateFile(null); setMaterialsFile(null); setAthFile(null);
      router.refresh();
    } catch {
      setError("Błąd połączenia");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notatka (opcjonalnie)"
        className="w-full px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <label className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors ${athFile ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
        <input ref={athRef} type="file" accept=".ath" className="hidden" onChange={(e) => { const f = e.target.files?.[0] ?? null; setAthFile(f); if (f) { setEstimateFile(null); setMaterialsFile(null); } }} />
        📁 {athFile ? athFile.name.slice(0, 24) + "…" : "Plik ATH (kosztorys + materiały)"}
      </label>
      {!athFile && (
        <div className="flex gap-2">
          <label className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors ${estimateFile ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
            <input ref={estRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setEstimateFile(e.target.files?.[0] ?? null)} />
            📄 {estimateFile ? estimateFile.name.slice(0, 20) + "…" : "Kosztorys PDF (Typ B)"}
          </label>
          <label className={`flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg border cursor-pointer text-xs transition-colors ${materialsFile ? "border-blue-300 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:border-gray-300"}`}>
            <input ref={matRef} type="file" accept=".pdf" className="hidden" onChange={(e) => setMaterialsFile(e.target.files?.[0] ?? null)} />
            📋 {materialsFile ? materialsFile.name.slice(0, 20) + "…" : "Materiały PDF (Typ A)"}
          </label>
        </div>
      )}
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="btn btn-primary btn-sm w-full py-1.5">
        {loading ? "Przetwarzanie..." : "Dodaj wersję"}
      </button>
    </form>
  );
}
