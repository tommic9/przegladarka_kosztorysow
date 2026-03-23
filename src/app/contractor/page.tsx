import Link from "next/link";
import { getSession } from "@/lib/auth";
import db from "@/lib/db";

function fmt(n: number | null): string {
  if (n === null) return "—";
  return new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default async function ContractorPage() {
  const session = await getSession();
  if (!session) return null;

  const projects = db
    .prepare(
      `SELECT p.*, pv.version_number, pv.uploaded_at, pv.total_brutto,
              (SELECT COUNT(*) FROM materials WHERE version_id = pv.id) as material_count
       FROM projects p
       JOIN project_access pa ON pa.project_id = p.id AND pa.user_id = ?
       LEFT JOIN project_versions pv ON pv.project_id = p.id
         AND pv.version_number = (SELECT MAX(version_number) FROM project_versions WHERE project_id = p.id)
       ORDER BY p.created_at DESC`
    )
    .all(session.userId) as {
    id: number; title: string; investor: string | null; address: string | null;
    version_number: number | null; uploaded_at: string | null;
    total_brutto: number | null; material_count: number;
  }[];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Moje projekty</h1>

      {projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">Nie masz jeszcze przypisanych projektów.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/contractor/projects/${p.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-sm transition-all block"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{p.title}</h2>
                  {p.investor && <p className="text-sm text-gray-500 mt-0.5">{p.investor}</p>}
                  {p.address && <p className="text-xs text-gray-400 mt-0.5">{p.address}</p>}
                </div>
                <div className="text-right shrink-0 ml-4">
                  {p.total_brutto && (
                    <p className="font-semibold text-gray-900">{fmt(p.total_brutto)} zł</p>
                  )}
                  <p className="text-xs text-gray-400">
                    {p.version_number ? `v${p.version_number}` : ""}
                    {p.uploaded_at ? ` · ${new Date(p.uploaded_at).toLocaleDateString("pl-PL")}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                <span>{p.material_count} materiałów</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
