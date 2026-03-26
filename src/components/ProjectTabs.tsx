"use client";

import { useState } from "react";
import MaterialsByDept from "@/components/MaterialsByDept";
import CostCalculator from "@/components/CostCalculator";
import VersionDiff from "@/components/VersionDiff";

type Material = { id: number; lp: number | null; index_code: string | null; name: string; unit: string | null; total_qty: number | null; unit_price: number | null; total_value: number | null };
type MaterialDept = { id: number; material_id: number; dept_number: string; dept_name: string; sub_dept_number: string | null; sub_dept_name: string | null; qty: number | null; value: number | null };
type CostChapter = { id: number; number: string; name: string; order_index: number; total_netto: number | null };
type CostItem = { id: number; chapter_id: number | null; lp: string | null; knr: string | null; name: string; unit: string | null; qty: number | null; unit_price: number | null; total_value_netto: number | null; measurement: string | null };
type Version = { id: number; version_number: number; uploaded_at: string; notes: string | null };
type Meta = { title: string; investor: string | null; address: string | null; contractor_name: string | null; vat_rate: number | null };

const TABS = [
  { id: "materials", label: "📋 Materiały" },
  { id: "calculator", label: "💰 Kalkulator oferty" },
  { id: "diff", label: "🔄 Porównaj wersje" },
];

export default function ProjectTabs({
  materials, depts, chapters, items, versions, projectId, currentVersionId, meta, versionDate,
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
}) {
  const hasMaterials = materials.length > 0;
  const hasCalculator = items.length > 0;
  const hasDiff = versions.length >= 2;

  const defaultTab = hasCalculator ? "calculator" : hasMaterials ? "materials" : "materials";
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  return (
    <div>
      {/* Tab bar — hidden on print */}
      <div className="flex gap-1.5 mb-6 no-print">
        {TABS.map((tab) => {
          const disabled =
            (tab.id === "materials" && !hasMaterials) ||
            (tab.id === "calculator" && !hasCalculator) ||
            (tab.id === "diff" && !hasDiff);
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => !disabled && setActiveTab(tab.id)}
              disabled={disabled}
              className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                isActive
                  ? "bg-blue-600 border-blue-700 text-white"
                  : disabled
                  ? "border-gray-200 text-gray-300 cursor-default bg-white"
                  : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-gray-400"
              }`}
            >
              {tab.label}
              {tab.id === "materials" && !hasMaterials && <span className="ml-1 text-xs opacity-60">(brak)</span>}
              {tab.id === "calculator" && !hasCalculator && <span className="ml-1 text-xs opacity-60">(brak)</span>}
              {tab.id === "diff" && !hasDiff && <span className="ml-1 text-xs opacity-60">(min. 2)</span>}
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

      {activeTab === "diff" && (
        <VersionDiff
          projectId={projectId}
          versions={versions}
          currentItems={items}
          currentVersionId={currentVersionId ?? 0}
        />
      )}
    </div>
  );
}
