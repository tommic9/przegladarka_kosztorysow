"use client";

import { useState, useRef } from "react";

type ProjectFile = {
  id: number;
  project_id: number;
  file_name: string;
  original_name: string;
  description: string | null;
  uploaded_at: string;
};

export default function ProjectFilesManager({
  projectId,
  initialFiles,
}: {
  projectId: number;
  initialFiles: ProjectFile[];
}) {
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("description", description);

    const res = await fetch(`/api/projects/${projectId}/files`, {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      const data = await res.json() as { file: ProjectFile };
      setFiles((prev) => [data.file, ...prev]);
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    setUploading(false);
  }

  async function handleDelete(id: number) {
    setDeletingId(id);
    const res = await fetch(`/api/files/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFiles((prev) => prev.filter((f) => f.id !== id));
    }
    setDeletingId(null);
  }

  return (
    <div>
      <form onSubmit={handleUpload} className="flex flex-col gap-2 mb-4">
        <input
          ref={fileInputRef}
          type="file"
          required
          className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-sm file:bg-gray-50 file:text-gray-700 hover:file:bg-gray-100"
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Opis pliku (opcjonalnie)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
          <button type="submit" disabled={uploading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 border border-blue-600 rounded-lg transition-colors disabled:opacity-60">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            {uploading ? "Przesyłanie…" : "Dodaj plik"}
          </button>
        </div>
      </form>

      {files.length === 0 ? (
        <p className="text-sm text-gray-400">Brak plików.</p>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
              <div className="min-w-0 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
                <div className="min-w-0">
                  <a href={`/api/files/${f.id}`} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-medium text-blue-600 hover:underline truncate block">
                    {f.original_name}
                  </a>
                  <p className="text-xs text-gray-400">
                    {new Date(f.uploaded_at).toLocaleDateString("pl-PL")}
                    {f.description && <span className="ml-2">{f.description}</span>}
                  </p>
                </div>
              </div>
              <button onClick={() => handleDelete(f.id)} disabled={deletingId === f.id}
                className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 shrink-0 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  <path d="M10 11v6"/><path d="M14 11v6"/>
                </svg>
                {deletingId === f.id ? "…" : "Usuń"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
