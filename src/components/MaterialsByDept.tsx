"use client";

import { useState, useMemo, useRef, useEffect } from "react";

type MaterialDept = {
  id: number; material_id: number; dept_number: string; dept_name: string;
  sub_dept_number: string | null; sub_dept_name: string | null;
  qty: number | null; value: number | null;
};

type Material = {
  id: number; lp: number | null; index_code: string | null; name: string;
  unit: string | null; total_qty: number | null; unit_price: number | null; total_value: number | null;
};

type CostChapter = { id: number; number: string; name: string; order_index: number; total_netto: number | null };

type DeptEntry = { number: string; name: string; items: { material: Material; dept: MaterialDept }[] };

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

function IndeterminateCheckbox({ checked, indeterminate, onChange }: {
  checked: boolean; indeterminate: boolean; onChange: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !checked && indeterminate;
  }, [checked, indeterminate]);
  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      className="h-4 w-4 rounded border-gray-300 text-blue-600 cursor-pointer shrink-0"
    />
  );
}

export default function MaterialsByDept({
  materials,
  depts,
  chapters,
}: {
  materials: Material[];
  depts: MaterialDept[];
  chapters?: CostChapter[];
}) {
  const allMaterials = materials.filter(m => (m.total_qty ?? 0) !== 0 && (m.total_value ?? 0) !== 0);

  // Build dept → materials map (top-level depts only) — for accordion sections
  const deptMap = new Map<string, DeptEntry>();
  for (const dept of depts) {
    if (dept.sub_dept_number) continue;
    const key = dept.dept_number;
    if (!deptMap.has(key)) {
      deptMap.set(key, { number: dept.dept_number, name: dept.dept_name, items: [] });
    }
    const mat = allMaterials.find((m) => m.id === dept.material_id);
    if (mat) deptMap.get(key)!.items.push({ material: mat, dept });
  }
  const deptList = Array.from(deptMap.values()).sort((a, b) => parseFloat(a.number) - parseFloat(b.number));

  // Build materialId → dept entries list (for chapter-based filtering)
  const matDeptEntries = useMemo(() => {
    const map = new Map<number, { dept_number: string; sub_dept_number: string | null }[]>();
    for (const d of depts) {
      if (!map.has(d.material_id)) map.set(d.material_id, []);
      map.get(d.material_id)!.push({ dept_number: d.dept_number, sub_dept_number: d.sub_dept_number });
    }
    return map;
  }, [depts]);

  // Determine filter mode — chapter filter requires dept data to be meaningful
  const hasDeptData = depts.length > 0;
  const useChapterFilter = !!(chapters && chapters.length > 0) && hasDeptData;
  const sortedChapters = useMemo(
    () => chapters ? [...chapters].sort((a, b) => a.order_index - b.order_index) : [],
    [chapters]
  );
  const allChapterNums = useMemo(() => new Set(sortedChapters.map(c => c.number)), [sortedChapters]);

  // Build chapter tree: parents (no dot) → sub-chapters (with dot)
  const chapterTree = useMemo(() => {
    const parents = sortedChapters.filter(c => !c.number.includes("."));
    return parents.map(p => ({
      ...p,
      subs: sortedChapters.filter(c => c.number.startsWith(p.number + ".")),
    }));
  }, [sortedChapters]);

  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  function toggleChapterExpand(num: string) {
    setExpandedChapters(prev => { const n = new Set(prev); n.has(num) ? n.delete(num) : n.add(num); return n; });
  }

  // ── Filter state ──
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(
    () => new Set(sortedChapters.map(c => c.number))
  );
  const allIds = useMemo(() => new Set(allMaterials.map(m => m.id)), [allMaterials]); // eslint-disable-line react-hooks/exhaustive-deps
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    () => new Set(allMaterials.map(m => m.id))
  );
  const [panelOpen, setPanelOpen] = useState(false);
  // For material-based mode: expand depts in filter
  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());

  const isChapterFiltered = useChapterFilter && selectedChapters.size < allChapterNums.size;
  const isMaterialFiltered = !useChapterFilter && (selectedIds.size < allIds.size || selectedIds.size === 0);
  const isFiltered = isChapterFiltered || isMaterialFiltered;

  const filteredMaterials = useMemo(() => {
    if (useChapterFilter) {
      if (!isChapterFiltered) return allMaterials;
      return allMaterials.filter(m => {
        const entries = matDeptEntries.get(m.id) ?? [];
        return entries.some(e =>
          selectedChapters.has(e.dept_number) ||
          (e.sub_dept_number && selectedChapters.has(e.sub_dept_number))
        );
      });
    }
    return isMaterialFiltered ? allMaterials.filter(m => selectedIds.has(m.id)) : allMaterials;
  }, [useChapterFilter, isChapterFiltered, isMaterialFiltered, allMaterials, matDeptEntries, selectedChapters, selectedIds]);

  const filteredDeptList = useMemo(() =>
    deptList
      .map(dept => ({
        ...dept,
        items: isFiltered
          ? dept.items.filter(i => filteredMaterials.some(m => m.id === i.material.id))
          : dept.items,
      }))
      .filter(dept => dept.items.length > 0),
    [deptList, isFiltered, filteredMaterials]
  );

  // Chapter filter helpers
  function toggleParentChapter(num: string, subNums: string[]) {
    const checked = selectedChapters.has(num);
    setSelectedChapters(prev => {
      const n = new Set(prev);
      if (checked) { n.delete(num); subNums.forEach(s => n.delete(s)); }
      else          { n.add(num);    subNums.forEach(s => n.add(s)); }
      return n;
    });
  }
  function toggleSubChapter(num: string) {
    setSelectedChapters(prev => { const n = new Set(prev); n.has(num) ? n.delete(num) : n.add(num); return n; });
  }

  // Material filter helpers
  function isDeptAllSel(dept: DeptEntry) { return dept.items.every(i => selectedIds.has(i.material.id)); }
  function isDeptAnySel(dept: DeptEntry) { return dept.items.some(i => selectedIds.has(i.material.id)); }
  function toggleDept(dept: DeptEntry) {
    const allSel = isDeptAllSel(dept);
    setSelectedIds(prev => {
      const next = new Set(prev);
      for (const { material: m } of dept.items) allSel ? next.delete(m.id) : next.add(m.id);
      return next;
    });
  }
  function toggleMaterial(id: number) {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleDeptExpand(num: string) {
    setExpandedDepts(prev => { const n = new Set(prev); n.has(num) ? n.delete(num) : n.add(num); return n; });
  }

  // ── Accordion open state ──
  const allKeys = ["summary", ...deptList.map((d) => d.number)];
  const [openSet, setOpenSet] = useState<Set<string>>(() => new Set(allKeys));
  const toggle = (key: string) =>
    setOpenSet((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const allOpen = openSet.has("summary") && deptList.every((d) => openSet.has(d.number));

  // ── Summary sort state ──
  const [sumSort, setSumSort] = useState<{ col: SummaryCol; dir: SortDir }>({ col: "lp", dir: "asc" });
  function toggleSumSort(col: SummaryCol) {
    setSumSort((prev) => prev.col === col
      ? { col, dir: prev.dir === "asc" ? "desc" : "asc" }
      : { col, dir: "asc" }
    );
  }

  const sortedMaterials = useMemo(() => {
    return [...filteredMaterials].sort((a, b) => {
      switch (sumSort.col) {
        case "lp":          return cmp(a.lp, b.lp, sumSort.dir);
        case "name":        return cmp(a.name, b.name, sumSort.dir);
        case "unit":        return cmp(a.unit, b.unit, sumSort.dir);
        case "total_qty":   return cmp(a.total_qty, b.total_qty, sumSort.dir);
        case "unit_price":  return cmp(a.unit_price, b.unit_price, sumSort.dir);
        case "total_value": return cmp(a.total_value, b.total_value, sumSort.dir);
      }
    });
  }, [filteredMaterials, sumSort]);

  if (deptList.length === 0 && allMaterials.length === 0) {
    return <p className="text-sm text-gray-400 py-4">Brak danych o materiałach.</p>;
  }

  const grandTotal = filteredMaterials.reduce((sum, m) => sum + (m.total_value ?? 0), 0);

  // Filter panel summary label
  const filterLabel = useChapterFilter
    ? `${selectedChapters.size}/${allChapterNums.size} rozdziałów`
    : `${selectedIds.size}/${allIds.size} pozycji`;

  return (
    <div className="lg:flex lg:gap-5 lg:items-start">

      {/* ══ Filter panel ══ */}
      <div className="lg:w-60 lg:shrink-0 lg:sticky lg:top-4 mb-4 lg:mb-0">

        {/* Mobile toggle */}
        <button
          onClick={() => setPanelOpen(!panelOpen)}
          className="lg:hidden w-full flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2">
            <span>Filtruj zakres</span>
            {isFiltered && (
              <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {filterLabel}
              </span>
            )}
          </span>
          <span className="text-gray-400 text-xs">{panelOpen ? "▲" : "▼"}</span>
        </button>

        {/* Panel body */}
        <div className={`${panelOpen ? "block mt-2" : "hidden"} lg:block bg-white border border-gray-200 rounded-xl overflow-hidden`}>
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-800">Zakres roboczy</span>
            {isFiltered ? (
              <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                {filterLabel}
              </span>
            ) : (
              <span className="text-xs text-gray-400">
                {useChapterFilter ? `${allChapterNums.size} rozdz.` : `${allIds.size} poz.`}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="px-4 py-2 flex items-center gap-3 border-b border-gray-100">
            <button
              onClick={() => useChapterFilter
                ? setSelectedChapters(new Set(allChapterNums))
                : setSelectedIds(new Set(allIds))
              }
              className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            >
              Zaznacz wszystko
            </button>
            <span className="text-gray-200">|</span>
            <button
              onClick={() => useChapterFilter
                ? setSelectedChapters(new Set())
                : setSelectedIds(new Set())
              }
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Odznacz
            </button>
          </div>

          {/* ── Chapter-based filter (hierarchical) ── */}
          {useChapterFilter ? (
            <div className="max-h-[60vh] lg:max-h-[calc(100vh-260px)] overflow-y-auto divide-y divide-gray-50">
              {chapterTree.map(parent => {
                const subNums = parent.subs.map(s => s.number);
                const parentChecked = selectedChapters.has(parent.number);
                const someSubChecked = subNums.some(s => selectedChapters.has(s));
                const expanded = expandedChapters.has(parent.number);
                return (
                  <div key={parent.number}>
                    <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50">
                      <IndeterminateCheckbox
                        checked={parentChecked}
                        indeterminate={someSubChecked}
                        onChange={() => toggleParentChapter(parent.number, subNums)}
                      />
                      <button
                        onClick={() => subNums.length > 0 && toggleChapterExpand(parent.number)}
                        className="flex-1 flex items-center justify-between text-left min-w-0"
                      >
                        <div className="min-w-0">
                          <span className="text-xs font-semibold text-gray-500">{parent.number}.</span>
                          {" "}
                          <span className="text-xs font-medium text-gray-800 leading-tight">{parent.name}</span>
                          {parent.total_netto !== null && (
                            <div className="text-xs text-gray-400">{fmt(parent.total_netto)} zł</div>
                          )}
                        </div>
                        {subNums.length > 0 && (
                          <span className="text-gray-400 text-xs ml-1 shrink-0">{expanded ? "▲" : "▼"}</span>
                        )}
                      </button>
                    </div>
                    {expanded && subNums.length > 0 && (
                      <div className="bg-gray-50/60 divide-y divide-gray-100 pb-1">
                        {parent.subs.map(sub => (
                          <label key={sub.number} className="flex items-start gap-2 pl-8 pr-3 py-2 hover:bg-gray-100 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedChapters.has(sub.number)}
                              onChange={() => toggleSubChapter(sub.number)}
                              className="h-3.5 w-3.5 mt-0.5 rounded border-gray-300 text-blue-600 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <span className="text-xs text-gray-500">{sub.number}.</span>
                              {" "}
                              <span className="text-xs text-gray-700 leading-tight">{sub.name}</span>
                              {sub.total_netto !== null && (
                                <div className="text-xs text-gray-400">{fmt(sub.total_netto)} zł</div>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Material/dept-based filter (fallback) ── */
            <div className="max-h-[60vh] lg:max-h-[calc(100vh-260px)] overflow-y-auto divide-y divide-gray-50">
              {deptList.length === 0 ? (
                <p className="px-4 py-3 text-xs text-gray-400">Brak przypisanych działów.</p>
              ) : (
                deptList.map(dept => {
                  const allSel = isDeptAllSel(dept);
                  const anySel = isDeptAnySel(dept);
                  const expanded = expandedDepts.has(dept.number);
                  return (
                    <div key={dept.number}>
                      <div className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50">
                        <IndeterminateCheckbox
                          checked={allSel}
                          indeterminate={anySel}
                          onChange={() => toggleDept(dept)}
                        />
                        <button
                          onClick={() => toggleDeptExpand(dept.number)}
                          className="flex-1 flex items-center justify-between text-left min-w-0"
                        >
                          <span className="text-xs font-medium text-gray-800 leading-tight truncate pr-1">
                            {dept.number}. {dept.name}
                          </span>
                          <span className="text-gray-400 text-xs shrink-0">{expanded ? "▲" : "▼"}</span>
                        </button>
                      </div>
                      {expanded && (
                        <div className="bg-gray-50/60 pb-1">
                          {dept.items.map(({ material: m }) => (
                            <label key={m.id} className="flex items-start gap-2 px-4 py-1.5 hover:bg-gray-100 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={selectedIds.has(m.id)}
                                onChange={() => toggleMaterial(m.id)}
                                className="h-3.5 w-3.5 mt-0.5 rounded border-gray-300 text-blue-600 cursor-pointer shrink-0"
                              />
                              <span className="text-xs text-gray-700 leading-tight">{m.name}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Active filter footer */}
          {isFiltered && (
            <div className="px-4 py-2.5 border-t border-gray-100 bg-blue-50/50">
              <p className="text-xs text-blue-700">
                Wartość filtra: <span className="font-semibold">{fmt(grandTotal)} zł</span>
              </p>
              <button
                onClick={() => useChapterFilter
                  ? setSelectedChapters(new Set(allChapterNums))
                  : setSelectedIds(new Set(allIds))
                }
                className="text-xs text-blue-600 underline underline-offset-2 hover:text-blue-800 mt-0.5"
              >
                Pokaż wszystkie
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══ Materials content ══ */}
      <div className="flex-1 min-w-0 space-y-4">

        {/* Toolbar */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {isFiltered
              ? <>{filteredMaterials.length} <span className="text-blue-600 font-medium">z {allMaterials.length}</span> pozycji</>
              : <>{allMaterials.length} pozycji materiałowych</>
            }
          </p>
          <button
            onClick={allOpen ? () => setOpenSet(new Set()) : () => setOpenSet(new Set(allKeys))}
            className="btn btn-secondary btn-sm"
          >
            {allOpen ? "Zwiń wszystko" : "Rozwiń wszystko"}
          </button>
        </div>

        {/* Zestawienie całościowe */}
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
                    <SortTh label="Lp."              col="lp"          active={sumSort.col === "lp"}          dir={sumSort.dir} onClick={() => toggleSumSort("lp")} />
                    <SortTh label="Nazwa materiału"  col="name"         active={sumSort.col === "name"}        dir={sumSort.dir} onClick={() => toggleSumSort("name")} />
                    <SortTh label="j.m."             col="unit"         active={sumSort.col === "unit"}        dir={sumSort.dir} align="right" onClick={() => toggleSumSort("unit")} />
                    <SortTh label="Ilość łączna"     col="total_qty"    active={sumSort.col === "total_qty"}   dir={sumSort.dir} align="right" onClick={() => toggleSumSort("total_qty")} />
                    <SortTh label="Cena jedn. netto" col="unit_price"   active={sumSort.col === "unit_price"}  dir={sumSort.dir} align="right" onClick={() => toggleSumSort("unit_price")} />
                    <SortTh label="Wartość netto"    col="total_value"  active={sumSort.col === "total_value"} dir={sumSort.dir} align="right" onClick={() => toggleSumSort("total_value")} />
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

        {/* Działy */}
        {filteredDeptList.map((dept) => (
          <DeptSection
            key={dept.number}
            dept={dept}
            isOpen={openSet.has(dept.number)}
            onToggle={() => toggle(dept.number)}
          />
        ))}

        {isFiltered && filteredMaterials.length === 0 && (
          <p className="text-sm text-gray-400 py-4 text-center">Brak materiałów dla wybranego zakresu.</p>
        )}
      </div>
    </div>
  );
}

function DeptSection({
  dept, isOpen, onToggle,
}: {
  dept: DeptEntry;
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
                <SortTh label="Lp."              col="lp"         active={sort.col === "lp"}         dir={sort.dir} onClick={() => toggleSort("lp")} />
                <SortTh label="Nazwa materiału"  col="name"       active={sort.col === "name"}        dir={sort.dir} onClick={() => toggleSort("name")} />
                <SortTh label="j.m."             col="unit"       active={sort.col === "unit"}        dir={sort.dir} align="right" onClick={() => toggleSort("unit")} />
                <SortTh label="Ilość"            col="qty"        active={sort.col === "qty"}         dir={sort.dir} align="right" onClick={() => toggleSort("qty")} />
                <SortTh label="Cena jedn. netto" col="unit_price" active={sort.col === "unit_price"}  dir={sort.dir} align="right" onClick={() => toggleSort("unit_price")} />
                <SortTh label="Wartość netto"    col="value"      active={sort.col === "value"}       dir={sort.dir} align="right" onClick={() => toggleSort("value")} />
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
