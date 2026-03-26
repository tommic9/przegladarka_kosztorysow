import { notFound } from "next/navigation";
import Link from "next/link";
import db from "@/lib/db";
import ProjectAccessManager from "@/components/ProjectAccessManager";
import AddVersionForm from "@/components/AddVersionForm";
import ProjectTabs from "@/components/ProjectTabs";
import DeleteProjectButton from "@/components/DeleteProjectButton";
import ProjectFilesManager from "@/components/ProjectFilesManager";
import SettlementsManager from "@/components/SettlementsManager";

function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminProjectPage({ params }: PageProps) {
  const { id } = await params;
  const projectId = parseInt(id, 10);

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as
    | { id: number; title: string; investor: string | null; address: string | null; contractor_name: string | null; created_at: string }
    | undefined;

  if (!project) notFound();

  const versions = db
    .prepare("SELECT * FROM project_versions WHERE project_id = ? ORDER BY version_number DESC")
    .all(projectId) as {
    id: number; version_number: number; uploaded_at: string; notes: string | null;
    total_netto: number | null; vat_rate: number | null; vat_amount: number | null;
    total_brutto: number | null; materials_file_name: string | null; estimate_file_name: string | null;
  }[];

  const latestVersion = versions[0];
  const materialCount = latestVersion
    ? (db.prepare("SELECT COUNT(*) as c FROM materials WHERE version_id = ?").get(latestVersion.id) as { c: number }).c
    : 0;
  const itemCount = latestVersion
    ? (db.prepare("SELECT COUNT(*) as c FROM cost_items WHERE version_id = ?").get(latestVersion.id) as { c: number }).c
    : 0;

  let materials: unknown[] = [];
  let depts: unknown[] = [];
  let chapters: unknown[] = [];
  let items: unknown[] = [];

  if (latestVersion) {
    materials = db.prepare("SELECT * FROM materials WHERE version_id = ? ORDER BY lp").all(latestVersion.id);
    depts = db.prepare(
      `SELECT md.* FROM material_depts md JOIN materials m ON m.id = md.material_id WHERE m.version_id = ?`
    ).all(latestVersion.id);
    chapters = db.prepare("SELECT * FROM cost_chapters WHERE version_id = ? ORDER BY order_index").all(latestVersion.id);
    items = db.prepare("SELECT * FROM cost_items WHERE version_id = ? ORDER BY lp").all(latestVersion.id);
  }

  const allContractors = db
    .prepare("SELECT id, name, email FROM users WHERE role = 'contractor' ORDER BY name")
    .all() as { id: number; name: string; email: string }[];

  const assignedIds = db
    .prepare("SELECT user_id FROM project_access WHERE project_id = ?")
    .all(projectId)
    .map((r) => (r as { user_id: number }).user_id);

  const projectFiles = db
    .prepare("SELECT * FROM project_files WHERE project_id = ? ORDER BY uploaded_at DESC")
    .all(projectId) as {
    id: number; project_id: number; file_name: string; original_name: string;
    description: string | null; uploaded_at: string;
  }[];

  const assignedContractors = db
    .prepare(
      `SELECT u.id, u.name, u.email FROM users u
       JOIN project_access pa ON pa.user_id = u.id
       WHERE pa.project_id = ? ORDER BY u.name`
    )
    .all(projectId) as { id: number; name: string; email: string }[];

  const settlements = db
    .prepare(
      `SELECT s.*, u.name as contractor_name, u.email as contractor_email
       FROM settlements s JOIN users u ON u.id = s.contractor_id
       WHERE s.project_id = ? ORDER BY s.created_at DESC`
    )
    .all(projectId) as {
    id: number; project_id: number; contractor_id: number; contractor_name: string;
    contractor_email: string; description: string; amount: number;
    status: "pending" | "paid"; created_at: string;
  }[];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/admin" className="hover:text-gray-900">Projekty</Link>
            <span>/</span>
            <span>{project.title}</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
          {project.investor && <p className="text-gray-500 mt-0.5">{project.investor}</p>}
        </div>
        <DeleteProjectButton projectId={projectId} />
      </div>

      {/* Metadata + stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Wartość brutto", value: latestVersion?.total_brutto ? `${fmt(latestVersion.total_brutto)} zł` : "—" },
          { label: "Wartość netto", value: latestVersion?.total_netto ? `${fmt(latestVersion.total_netto)} zł` : "—" },
          { label: "Materiały", value: materialCount },
          { label: "Pozycje kosztorysu", value: itemCount },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500 mb-0.5">{s.label}</p>
            <p className="text-lg font-semibold text-gray-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Versions history */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Historia wersji</h2>
          {versions.length === 0 ? (
            <p className="text-sm text-gray-400">Brak wersji.</p>
          ) : (
            <div className="space-y-2">
              {versions.map((v) => (
                <div key={v.id} className="flex items-start justify-between text-sm">
                  <div>
                    <span className="font-medium text-gray-900">v{v.version_number}</span>
                    {v.notes && <span className="text-gray-500 ml-2">{v.notes}</span>}
                    <div className="text-xs text-gray-400">
                      {new Date(v.uploaded_at).toLocaleDateString("pl-PL")}
                      {v.estimate_file_name && <span className="ml-2">📄 {v.estimate_file_name}</span>}
                      {v.materials_file_name && <span className="ml-2">📋 {v.materials_file_name}</span>}
                    </div>
                  </div>
                  {v.total_brutto && (
                    <span className="text-gray-600 shrink-0 ml-2">{fmt(v.total_brutto)} zł</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Dodaj nową wersję</h3>
            <AddVersionForm projectId={projectId} />
          </div>
        </div>

        {/* Access management */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Dostęp wykonawców</h2>
          <ProjectAccessManager
            projectId={projectId}
            allContractors={allContractors}
            assignedIds={assignedIds}
          />
        </div>
      </div>

      {/* Project details */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Dane projektu</h2>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
          {[
            { label: "Nazwa inwestycji", value: project.title },
            { label: "Adres", value: project.address },
            { label: "Inwestor", value: project.investor },
            { label: "Wykonawca", value: project.contractor_name },
          ].map((item) => (
            <div key={item.label}>
              <dt className="text-gray-500">{item.label}</dt>
              <dd className="font-medium text-gray-900">{item.value || "—"}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Files + Settlements */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Pliki do pobrania</h2>
          <ProjectFilesManager projectId={projectId} initialFiles={projectFiles} />
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Rozliczenia</h2>
          <SettlementsManager
            projectId={projectId}
            initialSettlements={settlements}
            contractors={assignedContractors}
          />
        </div>
      </div>

      {/* Contractor view */}
      {latestVersion && (
        <div>
          <h2 className="text-base font-semibold text-gray-700 mb-4">Podgląd widoku wykonawcy</h2>
          <ProjectTabs
            materials={materials as Parameters<typeof ProjectTabs>[0]["materials"]}
            depts={depts as Parameters<typeof ProjectTabs>[0]["depts"]}
            chapters={chapters as Parameters<typeof ProjectTabs>[0]["chapters"]}
            items={items as Parameters<typeof ProjectTabs>[0]["items"]}
            versions={versions}
            projectId={projectId}
            currentVersionId={latestVersion.id}
            meta={{
              title: project.title,
              investor: project.investor,
              address: project.address,
              contractor_name: project.contractor_name,
              vat_rate: latestVersion.vat_rate ?? null,
            }}
            versionDate={latestVersion.uploaded_at}
            files={projectFiles}
          />
        </div>
      )}
    </div>
  );
}
