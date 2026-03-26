import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import db from "@/lib/db";
import ProjectTabs from "@/components/ProjectTabs";

type PageProps = { params: Promise<{ id: string }> };

export default async function ContractorProjectPage({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const projectId = parseInt(id, 10);

  // Check access
  const access = db
    .prepare("SELECT 1 FROM project_access WHERE project_id = ? AND user_id = ?")
    .get(projectId, session.userId);
  if (!access) notFound();

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as
    | { id: number; title: string; investor: string | null; address: string | null; contractor_name: string | null }
    | undefined;
  if (!project) notFound();

  const versions = db
    .prepare("SELECT * FROM project_versions WHERE project_id = ? ORDER BY version_number DESC")
    .all(projectId) as {
    id: number; version_number: number; uploaded_at: string; notes: string | null;
    total_netto: number | null; vat_rate: number | null; total_brutto: number | null;
  }[];

  const latestVersion = versions[0];

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

  const projectFiles = db
    .prepare("SELECT id, original_name, description, uploaded_at FROM project_files WHERE project_id = ? ORDER BY uploaded_at DESC")
    .all(projectId) as { id: number; original_name: string; description: string | null; uploaded_at: string }[];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <a href="/contractor" className="hover:text-gray-900">Projekty</a>
          <span>/</span>
          <span>{project.title}</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{project.title}</h1>
            {project.investor && <p className="text-gray-500 mt-0.5">{project.investor}</p>}
            {project.address && <p className="text-sm text-gray-400">{project.address}</p>}
          </div>
          <div className="text-right shrink-0 ml-4">
            {latestVersion?.total_brutto && (
              <p className="text-xl font-bold text-gray-900">
                {new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2 }).format(latestVersion.total_brutto)} zł
              </p>
            )}
            {latestVersion && (
              <p className="text-sm text-gray-400">
                v{latestVersion.version_number} · {new Date(latestVersion.uploaded_at).toLocaleDateString("pl-PL")}
              </p>
            )}
          </div>
        </div>
      </div>

      <ProjectTabs
        materials={materials as Parameters<typeof ProjectTabs>[0]["materials"]}
        depts={depts as Parameters<typeof ProjectTabs>[0]["depts"]}
        chapters={chapters as Parameters<typeof ProjectTabs>[0]["chapters"]}
        items={items as Parameters<typeof ProjectTabs>[0]["items"]}
        versions={versions}
        projectId={projectId}
        currentVersionId={latestVersion?.id ?? null}
        meta={{
          title: project.title,
          investor: project.investor,
          address: project.address,
          contractor_name: project.contractor_name,
          vat_rate: latestVersion?.vat_rate ?? null,
        }}
        versionDate={latestVersion?.uploaded_at ?? new Date().toISOString()}
        files={projectFiles}
      />
    </div>
  );
}
