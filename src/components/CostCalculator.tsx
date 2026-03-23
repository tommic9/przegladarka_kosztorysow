"use client";

import { useState, useMemo } from "react";

type CostChapter = {
  id: number; number: string; name: string; order_index: number; total_netto: number | null;
};

type CostItem = {
  id: number; chapter_id: number | null; lp: string | null; knr: string | null; name: string;
  unit: string | null; qty: number | null; unit_price: number | null; total_value_netto: number | null;
  measurement: string | null;
};

type ProjectMeta = {
  title: string; investor: string | null; address: string | null;
  contractor_name: string | null; vat_rate: number | null;
};

function fmt(n: number, decimals = 2): string {
  return new Intl.NumberFormat("pl-PL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

export default function CostCalculator({
  chapters,
  items,
  meta,
  versionDate,
}: {
  chapters: CostChapter[];
  items: CostItem[];
  meta: ProjectMeta;
  versionDate: string;
}) {
  const [disabled, setDisabled] = useState<Set<number>>(new Set());

  const vatRate = meta.vat_rate ?? 23;

  const { selectedNetto, totalNetto } = useMemo(() => {
    let sel = 0;
    let total = 0;
    for (const item of items) {
      const val = item.total_value_netto ?? 0;
      total += val;
      if (!disabled.has(item.id)) sel += val;
    }
    return { selectedNetto: sel, totalNetto: total };
  }, [items, disabled]);

  const selectedVat = selectedNetto * (vatRate / 100);
  const selectedBrutto = selectedNetto + selectedVat;

  function toggleItem(id: number) {
    setDisabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleChapter(chapterId: number | null) {
    const chapterItems = items.filter((i) => i.chapter_id === chapterId);
    const allDisabled = chapterItems.every((i) => disabled.has(i.id));
    setDisabled((prev) => {
      const next = new Set(prev);
      chapterItems.forEach((i) => {
        if (allDisabled) next.delete(i.id);
        else next.add(i.id);
      });
      return next;
    });
  }

  function resetAll() {
    setDisabled(new Set());
  }

  function handlePrint() {
    window.print();
  }

  // Group items by chapter
  const chapterItems = new Map<number | null, CostItem[]>();
  for (const item of items) {
    const key = item.chapter_id;
    if (!chapterItems.has(key)) chapterItems.set(key, []);
    chapterItems.get(key)!.push(item);
  }

  if (items.length === 0) {
    return <p className="text-sm text-gray-400 py-4">Brak danych kosztorysu.</p>;
  }

  return (
    <>
      {/* Print header — hidden on screen */}
      <div className="print-only mb-8">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold uppercase tracking-wide">Kosztorys ofertowy</h1>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm border border-gray-300 p-4 mb-4">
          {meta.title && (
            <>
              <span className="font-medium">NAZWA INWESTYCJI:</span>
              <span>{meta.title}</span>
            </>
          )}
          {meta.address && (
            <>
              <span className="font-medium">ADRES INWESTYCJI:</span>
              <span>{meta.address}</span>
            </>
          )}
          {meta.investor && (
            <>
              <span className="font-medium">NAZWA INWESTORA:</span>
              <span>{meta.investor}</span>
            </>
          )}
          {meta.contractor_name && (
            <>
              <span className="font-medium">WYKONAWCA:</span>
              <span>{meta.contractor_name}</span>
            </>
          )}
          <span className="font-medium">DATA OPRACOWANIA:</span>
          <span>{new Date(versionDate).toLocaleDateString("pl-PL")}</span>
        </div>
        {/* Totals summary in print header */}
        <div className="border border-gray-300 text-sm">
          <div className="flex justify-between px-4 py-1.5 border-b border-gray-200">
            <span className="font-medium">Wartość robót netto:</span>
            <span className="tabular-nums">{fmt(selectedNetto)} zł</span>
          </div>
          <div className="flex justify-between px-4 py-1.5 border-b border-gray-200">
            <span className="font-medium">Podatek VAT {vatRate}%:</span>
            <span className="tabular-nums">{fmt(selectedVat)} zł</span>
          </div>
          <div className="flex justify-between px-4 py-2 bg-gray-100">
            <span className="font-bold">Wartość robót brutto:</span>
            <span className="font-bold tabular-nums">{fmt(selectedBrutto)} zł</span>
          </div>
        </div>
      </div>

      {/* Toolbar — hidden on print */}
      <div className="no-print flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-sm text-gray-500">
          Zaznacz pozycje do uwzględnienia w ofercie. Odznaczone pozycje nie będą widoczne w druku.
        </p>
        <div className="flex gap-2">
          <button onClick={resetAll} className="btn btn-secondary">
            Zaznacz wszystkie
          </button>
          <button onClick={handlePrint} className="btn btn-primary">
            🖨 Drukuj ofertę
          </button>
        </div>
      </div>

      {/* Chapters */}
      <div className="space-y-6">
        {chapters.map((chapter) => {
          const chItems = chapterItems.get(chapter.id) ?? [];
          if (chItems.length === 0) return null;
          const allDisabledInChapter = chItems.every((i) => disabled.has(i.id));
          const chapterSelectedNetto = chItems.reduce(
            (sum, i) => sum + (disabled.has(i.id) ? 0 : (i.total_value_netto ?? 0)),
            0
          );

          return (
            <div key={chapter.id} data-all-disabled={allDisabledInChapter ? "true" : undefined} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Chapter header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <label className="flex items-center gap-2 cursor-pointer no-print">
                  <input
                    type="checkbox"
                    checked={!allDisabledInChapter}
                    onChange={() => toggleChapter(chapter.id)}
                    className="w-4 h-4 rounded"
                  />
                  <span className="font-semibold text-gray-900 text-sm">
                    {chapter.number}. {chapter.name}
                  </span>
                </label>
                <span className="font-semibold text-sm print-only">
                  {chapter.number}. {chapter.name}
                </span>
                <span className="text-sm font-medium text-gray-700">
                  {fmt(chapterSelectedNetto)} zł
                </span>
              </div>

              {/* Items table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-white">
                      <th className="w-8 px-3 py-2 no-print"></th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Lp.</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Podstawa</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">Opis</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">j.m.</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Ilość</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Cena jedn. netto</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">Wartość netto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chItems.map((item, idx) => {
                      const isDisabled = disabled.has(item.id);
                      return (
                        <tr
                          key={item.id}
                          data-disabled={isDisabled ? "true" : undefined}
                          className={`border-b border-gray-50 transition-colors ${
                            isDisabled
                              ? "opacity-40"
                              : idx % 2 === 1
                              ? "bg-gray-50/50"
                              : ""
                          }`}
                        >
                          <td className="px-3 py-2 no-print">
                            <input
                              type="checkbox"
                              checked={!isDisabled}
                              onChange={() => toggleItem(item.id)}
                              className="w-4 h-4 rounded"
                            />
                          </td>
                          <td className={`px-3 py-2 text-gray-500 ${isDisabled ? "line-through" : ""}`}>
                            {item.lp}
                          </td>
                          <td className={`px-3 py-2 text-gray-500 font-mono text-xs ${isDisabled ? "line-through" : ""}`}>
                            {item.knr || "—"}
                          </td>
                          <td className={`px-3 py-2 text-gray-900 max-w-xs ${isDisabled ? "line-through" : ""}`}>
                            {item.name}
                            {item.measurement && (
                              <div className="text-xs text-gray-400 font-mono mt-0.5 no-print">
                                📐 {item.measurement}
                              </div>
                            )}
                            {item.measurement && (
                              <div className="text-xs text-gray-400 font-mono mt-0.5 print-only">
                                Obmiar: {item.measurement}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right text-gray-600">{item.unit || "—"}</td>
                          <td className="px-3 py-2 text-right text-gray-900">{item.qty !== null ? fmt(item.qty, 2) : "—"}</td>
                          <td className="px-3 py-2 text-right text-gray-600">
                            {item.unit_price !== null ? fmt(item.unit_price) : "—"}
                          </td>
                          <td className={`px-3 py-2 text-right font-medium text-gray-900 ${isDisabled ? "line-through" : ""}`}>
                            {item.total_value_netto !== null ? `${fmt(item.total_value_netto)} zł` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td colSpan={7} className="px-3 py-2 text-right text-xs font-semibold text-gray-600">
                        Razem netto:
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900">
                        {fmt(chapterSelectedNetto)} zł
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary */}
      <div className="mt-6 border-t-2 border-gray-900 pt-4">
        <div className="max-w-sm ml-auto border border-gray-300 rounded-lg overflow-hidden text-sm">
          <div className="flex justify-between px-4 py-2 bg-gray-50">
            <span className="text-gray-600">Wartość robót netto:</span>
            <span className="font-medium tabular-nums">{fmt(selectedNetto)} zł</span>
          </div>
          <div className="flex justify-between px-4 py-2 border-t border-gray-200">
            <span className="text-gray-600">Podatek VAT {vatRate}%:</span>
            <span className="font-medium tabular-nums">{fmt(selectedVat)} zł</span>
          </div>
          <div className="flex justify-between px-4 py-2.5 border-t-2 border-gray-900 bg-gray-900 text-white">
            <span className="font-bold">Wartość robót brutto:</span>
            <span className="font-bold tabular-nums">{fmt(selectedBrutto)} zł</span>
          </div>
        </div>
        {disabled.size > 0 && (
          <p className="text-xs text-gray-400 mt-2 no-print text-right">
            Wyłączono {disabled.size} pozycji ({fmt(totalNetto - selectedNetto)} zł netto)
          </p>
        )}
      </div>
    </>
  );
}
