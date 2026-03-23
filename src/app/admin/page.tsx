import Link from "next/link";
import db from "@/lib/db";

function fmt(n: number | null): string {
  if (n === null) return "—";
  return new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default function AdminProjectsPage() {
  const projects = db
    .prepare(
      `SELECT p.*, pv.id as version_id, pv.version_number, pv.uploaded_at, pv.total_brutto, pv.total_netto,
              (SELECT COUNT(*) FROM materials WHERE version_id = pv.id) as material_count,
              (SELECT COUNT(*) FROM cost_items WHERE version_id = pv.id) as item_count
       FROM projects p
       LEFT JOIN project_versions pv ON pv.project_id = p.id
         AND pv.version_number = (SELECT MAX(version_number) FROM project_versions WHERE project_id = p.id)
       ORDER BY p.created_at DESC`
    )
    .all() as {
    id: number; title: string; investor: string | null; created_at: string;
    version_number: number | null; uploaded_at: string | null;
    total_brutto: number | null; total_netto: number | null;
    material_count: number; item_count: number;
  }[];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Projekty</h1>
        <Link href="/admin/projects/new" className="btn btn-primary px-4 py-2">
          + Nowy projekt
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">Brak projektów. Dodaj pierwszy projekt.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Projekt</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Inwestor</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Wersja</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Materiały</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Pozycje</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Wartość brutto</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Data</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.title}</td>
                  <td className="px-4 py-3 text-gray-600">{p.investor || "—"}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    {p.version_number ? `v${p.version_number}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.material_count || 0}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{p.item_count || 0}</td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {p.total_brutto ? `${fmt(p.total_brutto)} zł` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-500 text-xs">
                    {p.uploaded_at ? new Date(p.uploaded_at).toLocaleDateString("pl-PL") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/projects/${p.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      Otwórz →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
