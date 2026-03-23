"use client";

import { useState, useMemo } from "react";

type MaterialDept = {
  id: number; material_id: number; dept_number: string; dept_name: string;
  sub_dept_number: string | null; sub_dept_name: string | null;
  qty: number | null; value: number | null;
};

type Material = {
  id: number; lp: number | null; index_code: string | null; name: string;
  unit: string | null; total_qty: number | null; unit_price: number | null; total_value: number | null;
};

type SortDir = "asc" | "desc";
type SummaryCol = "lp" | "name" | "unit" | "total_qty" | "unit_price" | "total_value";
type DeptCol = "lp" | "name" | "unit" | "qty" | "unit_price" | "value";

function fmt(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function SortTh({
  label, col, active, dir, align = "left", onClick,
}: {
  label: string; col: string; active: boolean; dir: SortDir;
  align?: "left" | "right"; onClick: () => void;
}) {
  return (
    <th
      onClick={onClick}
      className={`px-4 py-2 text-xs font-medium cursor-pointer select-none whitespace-nowrap
        text-${align} ${active ? "text-blue-600" : "text-gray-500 hover:text-gray-800"}`}
    >
      {label}
      <span className="ml-1 opacity-60">{active ? (dir === "asc" ? "▲" : "▼") : "⇅"}</span>
    </th>
  );
}

function cmp<T>(a: T, b: T, dir: SortDir): number {
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  const v = a < b ? -1 : a > b ? 1 : 0;
  return dir === "asc" ? v : -v;
}

export default function MaterialsByDept({
  materials,
  depts,
}: {
  materials: Material[];
  depts: MaterialDept[];
}) {
  // Build dept → materials map (top-level depts only)
  const deptMap = new Map<string, { number: string; name: string; items: { material: Material; dept: MaterialDept }[] }>();

  for (const dept of depts) {
    if (dept.sub_dept_number) continue;
    const key = dept.dept_number;
    if (!deptMap.has(key)) {
      deptMap.set(key, { number: dept.dept_number, name: dept.dept_name, items: [] });
    }
    const mat = materials.find((m) => m.id === dept.material_id);
    if (mat) deptMap.get(key)!.items.push({ material: mat, dept });
  }

  const deptList = Array.from(deptMap.values()).sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

  // Open state
  const allKeys = ["summary", ...deptList.map((d) => d.number)];
  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set(allKeys));
  const toggle = (key: string) =>
    setOpenSet((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const allOpen = openSet.has("summary") && deptList.every((d) => openSet.has(d.number));

  // Summary sort state
  const [sumSort, setSumSort] = useState<{ col: SummaryCol; dir: SortDir }>({ col: "lp", dir: "asc" });

  function toggleSumSort(col: SummaryCol) {
    setSumSort((prev) => prev.col === col
      ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { col, dir: "asc" }
    );
  }

  const sortedMaterials = useMemo(() => {
    return [...materials].sort((a, b) => {
      switch (sumSort.col) {
        case "lp":         return cmp(a.lp, b.lp, sumSort.dir);
        case "name":       return cmp(a.name, b.name, sumSort.dir);
        case "unit":       return cmp(a.unit, b.unit, sumSort.dir);
        case "total_qty":  return cmp(a.total_qty, b.total_qty, sumSort.dir);
        case "unit_price": return cmp(a.unit_price, b.unit_price, sumSort.dir);
        case "total_value":return cmp(a.total_value, b.total_value, sumSort.dir);
      }
    });
  }, [materials, sumSort]);

  if (deptList.length === 0 && materials.length === 0) {
    return <p className="text-sm text-gray-400 py-4">Brak danych o materiałach.</p>;
  }

  const grandTotal = materials.reduce((sum, m) => sum + (m.total_value ?? 0), 0);

  return (
    <div className="space-y-4">

      {/* ── Toolbar ── */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{materials.length} pozycji materiałowych</p>
        <button
          onClick={allOpen ? () => setOpenSet(new Set()) : () => setOpenSet(new Set(allKeys))}
          className="btn btn-secondary btn-sm"
        >
          {allOpen ? "Zwiń wszystko" : "Rozwiń wszystko"}
        </button>
      </div>

      {/* ── Zestawienie całościowe ── */}
      <div className="border border-blue-100 rounded-xl overflow-hidden">
        <button
          onClick={() => toggle("summary")}
          className="w-full flex items-center justify-between px-4 py-3 bg-blue-50 hover:bg-blue-100 transition-colors text-left"
        >
          <span className="font-semibold text-blue-900 text-sm">Zestawienie całościowe materiałów</span>
          <div className="flex items-center gap-4">
            <span className="text-sm text-blue-700 font-medium">{fmt(grandTotal)} zł</span>
            <span className="text-blue-400 text-xs">{openSet.has("summary") ? "▲" : "▼"}</span>
          </div>
        </button>

        {openSet.has("summary") && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-white">
                  <SortTh label="Lp."         col="lp"          active={sumSort.col === "lp"}          dir={sumSort.dir} onClick={() => toggleSumSort("lp")} />
                  <SortTh label="Nazwa materiału" col="name"     active={sumSort.col === "name"}        dir={sumSort.dir} onClick={() => toggleSumSort("name")} />
                  <SortTh label="j.m."         col="unit"        active={sumSort.col === "unit"}        dir={sumSort.dir} align="right" onClick={() => toggleSumSort("unit")} />
                  <SortTh label="Ilość łączna" col="total_qty"   active={sumSort.col === "total_qty"}   dir={sumSort.dir} align="right" onClick={() => toggleSumSort("total_qty")} />
                  <SortTh label="Cena jedn. netto" col="unit_price"  active={sumSort.col === "unit_price"}  dir={sumSort.dir} align="right" onClick={() => toggleSumSort("unit_price")} />
                  <SortTh label="Wartość netto"    col="total_value" active={sumSort.col === "total_value"} dir={sumSort.dir} align="right" onClick={() => toggleSumSort("total_value")} />
                </tr>
              </thead>
              <tbody>
                {sortedMaterials.map((m, idx) => (
                  <tr key={m.id} className={`border-b border-gray-50 ${idx % 2 === 1 ? "bg-gray-50/50" : ""}`}>
                    <td className="px-4 py-2 text-gray-400">{m.lp}</td>
                    <td className="px-4 py-2 text-gray-900">{m.name}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{m.unit || "—"}</td>
                    <td className="px-4 py-2 text-right text-gray-900 font-medium">{fmt(m.total_qty, 4)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{fmt(m.unit_price)}</td>
                    <td className="px-4 py-2 text-right font-medium text-gray-900">{fmt(m.total_value)} zł</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-blue-50">
                  <td colSpan={5} className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Razem netto:</td>
                  <td className="px-4 py-2 text-right font-bold text-blue-900">{fmt(grandTotal)} zł</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* ── Działy ── */}
      {deptList.map((dept) => (
        <DeptSection
          key={dept.number}
          dept={dept}
          isOpen={openSet.has(dept.number)}
          onToggle={() => toggle(dept.number)}
        />
      ))}
    </div>
  );
}

function DeptSection({
  dept, isOpen, onToggle,
}: {
  dept: { number: string; name: string; items: { material: Material; dept: MaterialDept }[] };
  isOpen: boolean;
  onToggle: () => void;
}) {
  const [sort, setSort] = useState<{ col: DeptCol; dir: SortDir }>({ col: "lp", dir: "asc" });

  function toggleSort(col: DeptCol) {
    setSort((prev) => prev.col === col
      ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { col, dir: "asc" }
    );
  }

  const sorted = useMemo(() => {
    return [...dept.items].sort((a, b) => {
      switch (sort.col) {
        case "lp":         return cmp(a.material.lp, b.material.lp, sort.dir);
        case "name":       return cmp(a.material.name, b.material.name, sort.dir);
        case "unit":       return cmp(a.material.unit, b.material.unit, sort.dir);
        case "qty":        return cmp(a.dept.qty, b.dept.qty, sort.dir);
        case "unit_price": return cmp(a.material.unit_price, b.material.unit_price, sort.dir);
        case "value":      return cmp(a.dept.value, b.dept.value, sort.dir);
      }
    });
  }, [dept.items, sort]);

  const totalValue = dept.items.reduce((sum, i) => sum + (i.dept.value ?? 0), 0);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <span className="font-semibold text-gray-900 text-sm">{dept.number}. {dept.name}</span>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600 font-medium">{fmt(totalValue)} zł</span>
          <span className="text-gray-400 text-xs">{isOpen ? "▲" : "▼"}</span>
        </div>
      </button>

      {isOpen && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-white">
                <SortTh label="Lp."       col="lp"         active={sort.col === "lp"}         dir={sort.dir} onClick={() => toggleSort("lp")} />
                <SortTh label="Nazwa materiału" col="name" active={sort.col === "name"}        dir={sort.dir} onClick={() => toggleSort("name")} />
                <SortTh label="j.m."      col="unit"       active={sort.col === "unit"}        dir={sort.dir} align="right" onClick={() => toggleSort("unit")} />
                <SortTh label="Ilość"     col="qty"        active={sort.col === "qty"}         dir={sort.dir} align="right" onClick={() => toggleSort("qty")} />
                <SortTh label="Cena jedn. netto" col="unit_price" active={sort.col === "unit_price"} dir={sort.dir} align="right" onClick={() => toggleSort("unit_price")} />
                <SortTh label="Wartość netto"   col="value"      active={sort.col === "value"}       dir={sort.dir} align="right" onClick={() => toggleSort("value")} />
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ material: m, dept: d }, idx) => (
                <tr key={m.id} className={`border-b border-gray-50 ${idx % 2 === 1 ? "bg-gray-50/50" : ""}`}>
                  <td className="px-4 py-2 text-gray-400">{m.lp}</td>
                  <td className="px-4 py-2 text-gray-900">{m.name}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{m.unit || "—"}</td>
                  <td className="px-4 py-2 text-right text-gray-900">{fmt(d.qty, 4)}</td>
                  <td className="px-4 py-2 text-right text-gray-600">{fmt(m.unit_price)}</td>
                  <td className="px-4 py-2 text-right font-medium text-gray-900">{fmt(d.value)} zł</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-200 bg-gray-50">
                <td colSpan={5} className="px-4 py-2 text-right text-xs font-semibold text-gray-600">Razem netto:</td>
                <td className="px-4 py-2 text-right font-bold text-gray-900">{fmt(totalValue)} zł</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
