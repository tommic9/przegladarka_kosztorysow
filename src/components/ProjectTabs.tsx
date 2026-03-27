"use client";

import { useState } from "react";
import MaterialsByDept from "@/components/MaterialsByDept";
import CostCalculator from "@/components/CostCalculator";
import VersionDiff from "@/components/VersionDiff";
import ProjectStats from "@/components/ProjectStats";

type Material = { id: number; lp: number | null; index_code: string | null; name: string; unit: string | null; total_qty: number | null; unit_price: number | null; total_value: number | null };
type MaterialDept = { id: number; material_id: number; dept_number: string; dept_name: string; sub_dept_number: string | null; sub_dept_name: string | null; qty: number | null; value: number | null };
type CostChapter = { id: number; number: string; name: string; order_index: number; total_netto: number | null };
type CostItem = { id: number; chapter_id: number | null; lp: string | null; knr: string | null; name: string; unit: string | null; qty: number | null; unit_price: number | null; total_value_netto: number | null; measurement: string | null };
type Version = { id: number; version_number: number; uploaded_at: string; notes: string | null };
type Meta = { title: string; investor: string | null; address: string | null; contractor_name: string | null; vat_rate: number | null; total_netto: number | null; total_rg: number | null };
type ProjectFile = { id: number; original_name: string; description: string | null; uploaded_at: string };

const TABS = [
  {
    id: "calculator",
    label: "Kalkulator oferty",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="2" width="16" height="20" rx="2"/>
        <line x1="8" y1="6" x2="16" y2="6"/>
        <line x1="8" y1="10" x2="10" y2="10"/>
        <line x1="14" y1="10" x2="16" y2="10"/>
        <line x1="8" y1="14" x2="10" y2="14"/>
        <line x1="14" y1="14" x2="16" y2="14"/>
        <line x1="8" y1="18" x2="10" y2="18"/>
        <line x1="14" y1="18" x2="16" y2="18"/>
      </svg>
    ),
  },
  {
    id: "files",
    label: "Pliki",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
      </svg>
    ),
  },
  {
    id: "materials",
    label: "Materiały",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="3" width="6" height="6" rx="1"/>
        <rect x="2" y="13" width="6" height="6" rx="1"/>
        <line x1="12" y1="6" x2="22" y2="6"/>
        <line x1="12" y1="10" x2="22" y2="10"/>
        <line x1="12" y1="16" x2="22" y2="16"/>
        <line x1="12" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
  {
    id: "diff",
    label: "Porównaj wersje",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="9" y1="13" x2="15" y2="13"/>
        <line x1="9" y1="17" x2="12" y2="17"/>
        <line x1="9" y1="9" x2="10" y2="9"/>
      </svg>
    ),
  },
  {
    id: "stats",
    label: "Statystyki",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6" y1="20" x2="6" y2="14"/>
        <line x1="2" y1="20" x2="22" y2="20"/>
      </svg>
    ),
  },
];

export default function ProjectTabs({
  materials, depts, chapters, items, versions, projectId, currentVersionId, meta, versionDate, files,
}: {
  materials: Material[];
  depts: MaterialDept[];
  chapters: CostChapter[];
  items: CostItem[];
  versions: Version[];
  projectId: number;
  currentVersionId: number | null;
  meta: Meta;
  versionDate: string;
  files?: ProjectFile[];
}) {
  const hasMaterials = materials.length > 0;
  const hasCalculator = items.length > 0;
  const hasDiff = versions.length >= 2;
  const fileList = files ?? [];

  const defaultTab = hasCalculator ? "calculator" : hasMaterials ? "materials" : "materials";
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  return (
    <div>
      {/* Tab bar — hidden on print */}
      <div className="flex gap-1.5 mb-6 no-print flex-wrap">
        {TABS.map((tab) => {
          const disabled =
            (tab.id === "materials" && !hasMaterials) ||
            (tab.id === "calculator" && !hasCalculator) ||
            (tab.id === "stats" && !hasCalculator) ||
            (tab.id === "diff" && !hasDiff);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => !disabled && setActiveTab(tab.id)}
              disabled={disabled}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                isActive
                  ? "bg-blue-600 border-blue-700 text-white"
                  : disabled
                  ? "border-gray-200 text-gray-300 cursor-default bg-white"
                  : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400"
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.id === "materials" && !hasMaterials && <span className="text-xs opacity-60">(brak)</span>}
              {tab.id === "calculator" && !hasCalculator && <span className="text-xs opacity-60">(brak)</span>}
              {tab.id === "files" && fileList.length > 0 && (
                <span className="text-xs bg-blue-100 text-blue-700 rounded-full px-1.5 py-0.5 font-semibold">
                  {fileList.length}
                </span>
              )}
              {tab.id === "diff" && !hasDiff && <span className="text-xs opacity-60">(min. 2)</span>}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      {activeTab === "materials" && (
        <MaterialsByDept materials={materials} depts={depts} />
      )}

      {activeTab === "calculator" && (
        <CostCalculator
          chapters={chapters}
          items={items}
          meta={meta}
          versionDate={versionDate}
        />
      )}

      {activeTab === "files" && (
        <FilesTab files={fileList} />
      )}

      {activeTab === "diff" && (
        <VersionDiff
          projectId={projectId}
          versions={versions}
          currentItems={items}
          currentVersionId={currentVersionId ?? 0}
        />
      )}

      {activeTab === "stats" && (
        <ProjectStats chapters={chapters} items={items} totalNetto={meta.total_netto} totalRg={meta.total_rg} />
      )}
    </div>
  );
}

function FilesTab({ files }: { files: ProjectFile[] }) {
  if (files.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <p className="text-gray-400 text-sm">Brak plików do pobrania.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
      {files.map((f) => (
        <div key={f.id} className="flex items-center justify-between gap-4 px-5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{f.original_name}</p>
            {f.description && <p className="text-xs text-gray-500 mt-0.5">{f.description}</p>}
            <p className="text-xs text-gray-400 mt-0.5">
              {new Date(f.uploaded_at).toLocaleDateString("pl-PL")}
            </p>
          </div>
          <a
            href={`/api/files/${f.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 hover:border-gray-400 transition-colors shrink-0"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            Pobierz
          </a>
        </div>
      ))}
    </div>
  );
}
