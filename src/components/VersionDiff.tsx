"use client";

import { useState, useEffect } from "react";

type CostItem = {
  id: number; lp: string | null; knr: string | null; name: string;
  unit: string | null; qty: number | null; unit_price: number | null; total_value_netto: number | null;
};

type Version = { id: number; version_number: number; uploaded_at: string; notes: string | null };

function fmt(n: number | null): string {
  if (n === null) return "—";
  return new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

type DiffStatus = "added" | "removed" | "changed" | "unchanged";

type DiffItem = {
  status: DiffStatus;
  lp: string | null;
  knr: string | null;
  name: string;
  unit: string | null;
  qty_a: number | null;
  qty_b: number | null;
  price_a: number | null;
  price_b: number | null;
  value_a: number | null;
  value_b: number | null;
};

export default function VersionDiff({
  projectId,
  versions,
  currentItems,
  currentVersionId,
}: {
  projectId: number;
  versions: Version[];
  currentItems: CostItem[];
  currentVersionId: number;
}) {
  const [compareVersionId, setCompareVersionId] = useState<number | null>(
    versions.length > 1 ? versions[1]?.id ?? null : null
  );
  const [compareItems, setCompareItems] = useState<CostItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showUnchanged, setShowUnchanged] = useState(false);

  useEffect(() => {
    if (!compareVersionId) return;
    setLoading(true);
    fetch(`/api/projects/${projectId}/versions?v=${compareVersionId}`)
      .then((r) => r.json())
      .then((d) => setCompareItems(d.items ?? []))
      .finally(() => setLoading(false));
  }, [compareVersionId, projectId]);

  if (versions.length < 2) {
    return (
      <div className="text-sm text-gray-400 py-4">
        Potrzebne są co najmniej 2 wersje projektu do porównania.
      </div>
    );
  }

  // Build diff
  const diff: DiffItem[] = [];

  const aMap = new Map(currentItems.map((i) => [i.name.trim(), i]));
  const bMap = new Map(compareItems.map((i) => [i.name.trim(), i]));

  const allNames = new Set([...aMap.keys(), ...bMap.keys()]);

  for (const name of allNames) {
    const a = aMap.get(name);
    const b = bMap.get(name);

    if (a && !b) {
      diff.push({ status: "added", lp: a.lp, knr: a.knr, name, unit: a.unit, qty_a: a.qty, qty_b: null, price_a: a.unit_price, price_b: null, value_a: a.total_value_netto, value_b: null });
    } else if (!a && b) {
      diff.push({ status: "removed", lp: b.lp, knr: b.knr, name, unit: b.unit, qty_a: null, qty_b: b.qty, price_a: null, price_b: b.unit_price, value_a: null, value_b: b.total_value_netto });
    } else if (a && b) {
      const changed =
        Math.abs((a.qty ?? 0) - (b.qty ?? 0)) > 0.001 ||
        Math.abs((a.unit_price ?? 0) - (b.unit_price ?? 0)) > 0.001 ||
        Math.abs((a.total_value_netto ?? 0) - (b.total_value_netto ?? 0)) > 0.01;
      diff.push({
        status: changed ? "changed" : "unchanged",
        lp: a.lp, knr: a.knr, name, unit: a.unit,
        qty_a: a.qty, qty_b: b.qty,
        price_a: a.unit_price, price_b: b.unit_price,
        value_a: a.total_value_netto, value_b: b.total_value_netto,
      });
    }
  }

  const added = diff.filter((d) => d.status === "added");
  const removed = diff.filter((d) => d.status === "removed");
  const changed = diff.filter((d) => d.status === "changed");
  const unchanged = diff.filter((d) => d.status === "unchanged");

  const valueDiff =
    currentItems.reduce((s, i) => s + (i.total_value_netto ?? 0), 0) -
    compareItems.reduce((s, i) => s + (i.total_value_netto ?? 0), 0);

  const currentVer = versions[0];
  const compareVer = versions.find((v) => v.id === compareVersionId);

  return (
    <div>
      {/* Version selector */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-700">Aktualna:</span>
          <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
            v{currentVer?.version_number} — {currentVer ? new Date(currentVer.uploaded_at).toLocaleDateString("pl-PL") : ""}
          </span>
        </div>
        <span className="text-gray-400">vs</span>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium text-gray-700">Porównaj z:</span>
          <select
            value={compareVersionId ?? ""}
            onChange={(e) => setCompareVersionId(parseInt(e.target.value, 10))}
            className="px-2 py-1 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {versions.slice(1).map((v) => (
              <option key={v.id} value={v.id}>
                v{v.version_number} — {new Date(v.uploaded_at).toLocaleDateString("pl-PL")}{v.notes ? ` (${v.notes})` : ""}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer ml-auto">
          <input
            type="checkbox"
            checked={showUnchanged}
            onChange={(e) => setShowUnchanged(e.target.checked)}
            className="w-3.5 h-3.5"
          />
          Pokaż bez zmian ({unchanged.length})
        </label>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Ładowanie...</p>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            {[
              { label: "Dodane", count: added.length, color: "bg-green-50 text-green-700 border-green-200" },
              { label: "Usunięte", count: removed.length, color: "bg-red-50 text-red-700 border-red-200" },
              { label: "Zmienione", count: changed.length, color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
              {
                label: "Różnica wartości",
                count: null,
                value: `${valueDiff >= 0 ? "+" : ""}${fmt(valueDiff)} zł`,
                color: valueDiff >= 0 ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200",
              },
            ].map((s) => (
              <div key={s.label} className={`rounded-lg border px-3 py-2 ${s.color}`}>
                <p className="text-xs opacity-75">{s.label}</p>
                <p className="font-bold text-lg">{s.value ?? s.count}</p>
              </div>
            ))}
          </div>

          {/* Diff table */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 w-6"></th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Lp.</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Opis</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Ilość (nowa)</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Ilość (stara)</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Wartość (nowa)</th>
                  <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Wartość (stara)</th>
                </tr>
              </thead>
              <tbody>
                {[...added, ...removed, ...changed, ...(showUnchanged ? unchanged : [])].map((item, idx) => (
                  <tr
                    key={`${item.name}-${idx}`}
                    className={`border-b border-gray-50 ${
                      item.status === "added"
                        ? "bg-green-50"
                        : item.status === "removed"
                        ? "bg-red-50"
                        : item.status === "changed"
                        ? "bg-yellow-50"
                        : ""
                    }`}
                  >
                    <td className="px-3 py-2 text-center text-xs">
                      {item.status === "added" ? "🟢" : item.status === "removed" ? "🔴" : item.status === "changed" ? "🟡" : ""}
                    </td>
                    <td className="px-3 py-2 text-gray-500 text-xs">{item.lp || "—"}</td>
                    <td className="px-3 py-2 text-gray-900 max-w-xs">
                      <span className={item.status === "removed" ? "line-through text-gray-400" : ""}>{item.name}</span>
                      {item.knr && <div className="text-xs text-gray-400 font-mono">{item.knr}</div>}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {item.qty_a !== null ? <span className={item.status === "changed" && item.qty_a !== item.qty_b ? "font-medium text-yellow-700" : ""}>{fmt(item.qty_a)} {item.unit}</span> : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400">
                      {item.qty_b !== null ? `${fmt(item.qty_b)} ${item.unit}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right font-medium">
                      {item.value_a !== null ? (
                        <span className={item.status === "added" ? "text-green-700" : item.status === "changed" ? "text-yellow-700" : ""}>
                          {fmt(item.value_a)} zł
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-400">
                      {item.value_b !== null ? <span className={item.status === "removed" ? "text-red-600 line-through" : ""}>{fmt(item.value_b)} zł</span> : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
