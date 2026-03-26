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
      {/* Upload form */}
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
          <button
            type="submit"
            disabled={uploading}
            className="btn btn-primary btn-sm"
          >
            {uploading ? "Przesyłanie…" : "Dodaj plik"}
          </button>
        </div>
      </form>

      {/* File list */}
      {files.length === 0 ? (
        <p className="text-sm text-gray-400">Brak plików.</p>
      ) : (
        <div className="space-y-2">
          {files.map((f) => (
            <div
              key={f.id}
              className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="min-w-0">
                <a
                  href={`/api/files/${f.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-blue-600 hover:underline truncate block"
                >
                  {f.original_name}
                </a>
                <p className="text-xs text-gray-400">
                  {new Date(f.uploaded_at).toLocaleDateString("pl-PL")}
                  {f.description && <span className="ml-2">{f.description}</span>}
                </p>
              </div>
              <button
                onClick={() => handleDelete(f.id)}
                disabled={deletingId === f.id}
                className="text-xs text-red-500 hover:text-red-700 shrink-0"
              >
                {deletingId === f.id ? "…" : "Usuń"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
