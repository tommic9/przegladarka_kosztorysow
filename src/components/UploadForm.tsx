"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export default function UploadForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [estimateFile, setEstimateFile] = useState<File | null>(null);
  const [materialsFile, setMaterialsFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const estimateRef = useRef<HTMLInputElement>(null);
  const materialsRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Podaj tytuł projektu"); return; }
    if (!estimateFile && !materialsFile) { setError("Dodaj co najmniej jeden plik PDF"); return; }

    setError("");
    setLoading(true);

    const fd = new FormData();
    fd.append("title", title);
    if (notes) fd.append("notes", notes);
    if (estimateFile) fd.append("estimate", estimateFile);
    if (materialsFile) fd.append("materials", materialsFile);

    try {
      const res = await fetch("/api/projects", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Błąd zapisu"); return; }
      router.push(`/admin/projects/${data.projectId}`);
    } catch {
      setError("Błąd połączenia z serwerem");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Title */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tytuł projektu <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="np. Piwnice Koniaków — Kolenda"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* PDFs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FileDropZone
          label="Kosztorys ofertowy (Typ B)"
          hint="Wyciągamy: metadane projektu + pozycje kosztorysu z cenami"
          file={estimateFile}
          onChange={setEstimateFile}
          inputRef={estimateRef}
        />
        <FileDropZone
          label="Zestawienie materiałów (Typ A)"
          hint="Wyciągamy: materiały wg działów"
          file={materialsFile}
          onChange={setMaterialsFile}
          inputRef={materialsRef}
        />
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Notatka do wersji <span className="text-gray-400">(opcjonalnie)</span>
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="np. Wersja wstępna, korekta po pomiarach..."
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={loading} className="btn btn-primary px-6 py-2">
          {loading ? "Przetwarzanie PDF..." : "Zapisz projekt"}
        </button>
        <button type="button" onClick={() => router.back()} className="btn btn-secondary px-4 py-2">
          Anuluj
        </button>
      </div>
    </form>
  );
}

function FileDropZone({
  label, hint, file, onChange, inputRef,
}: {
  label: string;
  hint: string;
  file: File | null;
  onChange: (f: File | null) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div
      className={`border-2 border-dashed rounded-xl p-4 cursor-pointer transition-colors ${
        file ? "border-blue-300 bg-blue-50" : "border-gray-200 hover:border-gray-300 bg-white"
      }`}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f?.type === "application/pdf") onChange(f);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
      <p className="text-sm font-medium text-gray-700 mb-1">{label}</p>
      <p className="text-xs text-gray-400 mb-3">{hint}</p>
      {file ? (
        <div className="flex items-center gap-2">
          <span className="text-xs text-blue-700 font-medium truncate">{file.name}</span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            className="text-xs text-gray-400 hover:text-red-500 shrink-0"
          >
            ✕
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-400">Kliknij lub przeciągnij plik PDF</p>
      )}
    </div>
  );
}
