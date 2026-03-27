"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

type CostChapter = { id: number; number: string; name: string; order_index: number; total_netto: number | null };
type CostItem = { id: number; chapter_id: number | null; lp: string | null; knr: string | null; name: string; unit: string | null; qty: number | null; unit_price: number | null; total_value_netto: number | null; measurement: string | null };

const fmt = (v: number) =>
  new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

const CHAPTER_COLORS = [
  "#4e8bb5", "#5fa37a", "#b58b4e", "#b55a4e", "#7b6eb5",
  "#4e9db5", "#b5804e", "#4eab7a", "#b54e80", "#6e7ab5",
  "#4eb5a3", "#a3b54e", "#7ab54e", "#b54e4e", "#4e5eb5",
];

function CustomBarTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 border border-sky-100 rounded-xl px-4 py-3 shadow-lg text-sm backdrop-blur-sm">
      <p className="text-slate-600 font-medium mb-1 max-w-xs leading-tight">{label}</p>
      <p className="text-sky-700 font-bold">{fmt(payload[0].value)} zł</p>
    </div>
  );
}

function CustomPieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { percent: number } }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-white/95 border border-sky-100 rounded-xl px-4 py-3 shadow-lg text-sm max-w-[260px] backdrop-blur-sm">
      <p className="text-slate-600 font-medium mb-1 leading-tight">{p.name}</p>
      <p className="text-sky-700 font-bold">{fmt(p.value)} zł</p>
      <p className="text-slate-400 text-xs mt-0.5">{(p.payload.percent * 100).toFixed(1)}%</p>
    </div>
  );
}

function SectionHeading({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className={`w-1 h-5 rounded-full ${color}`} />
      <h2 className="text-sm font-semibold text-slate-600 uppercase tracking-wide">{children}</h2>
    </div>
  );
}

export default function ProjectStats({
  chapters,
  items,
  totalNetto,
  totalRg,
}: {
  chapters: CostChapter[];
  items: CostItem[];
  totalNetto: number | null;
  totalRg: number | null;
}) {
  const { ratePerRg, chapterData, top10 } = useMemo(() => {
    const ratePerRg = totalRg && totalRg > 0 && totalNetto ? totalNetto / totalRg : null;

    const chapterData = chapters
      .filter((ch) => (ch.total_netto ?? 0) > 0)
      .map((ch) => ({ name: ch.name, value: ch.total_netto ?? 0 }));

    const top10 = [...items]
      .filter((i) => (i.total_value_netto ?? 0) > 0)
      .sort((a, b) => (b.total_value_netto ?? 0) - (a.total_value_netto ?? 0))
      .slice(0, 10)
      .map((i) => ({
        name: i.name.length > 60 ? i.name.slice(0, 57) + "…" : i.name,
        fullName: i.name,
        value: i.total_value_netto ?? 0,
      }));

    return { ratePerRg, chapterData, top10 };
  }, [chapters, items, totalNetto, totalRg]);

  const top10ChartHeight = Math.max(280, top10.length * 44);

  return (
    <div
      className="rounded-2xl p-6 space-y-6"
      style={{
        background: "linear-gradient(135deg, #f0f9ff 0%, #f8faff 35%, #fffbf0 70%, #fef9ec 100%)",
        backgroundImage: [
          "linear-gradient(135deg, #f0f9ff 0%, #f8faff 35%, #fffbf0 70%, #fef9ec 100%)",
          "radial-gradient(circle at 20% 20%, rgba(186,230,253,0.25) 0%, transparent 50%)",
          "radial-gradient(circle at 80% 80%, rgba(253,230,138,0.2) 0%, transparent 50%)",
        ].join(", "),
      }}
    >
      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {totalNetto !== null && (
          <div
            className="rounded-2xl border border-sky-200/70 px-5 py-5 shadow-sm"
            style={{ background: "linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold text-sky-500 uppercase tracking-widest">Wartość netto</p>
              <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-sky-900 leading-none">
              {fmt(totalNetto)}{" "}
              <span className="text-base font-semibold text-sky-400">zł</span>
            </p>
            <p className="text-xs text-sky-400 mt-1.5">kosztorys ofertowy netto</p>
          </div>
        )}

        {totalRg != null && totalRg > 0 && (
          <div
            className="rounded-2xl border border-amber-200/70 px-5 py-5 shadow-sm"
            style={{ background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest">Roboczogodziny</p>
              <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-amber-900 leading-none">
              {new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalRg)}{" "}
              <span className="text-base font-semibold text-amber-400">r-g</span>
            </p>
            <p className="text-xs text-amber-400 mt-1.5">łączna robocizna z ATH</p>
          </div>
        )}

        {ratePerRg !== null && (
          <div
            className="rounded-2xl border border-cyan-200/70 px-5 py-5 shadow-sm"
            style={{ background: "linear-gradient(135deg, #ecfeff 0%, #cffafe 60%, #e0f2fe 100%)" }}
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold text-cyan-600 uppercase tracking-widest">Stawka netto / r-g</p>
              <div className="w-8 h-8 rounded-lg bg-cyan-100 flex items-center justify-center shrink-0">
                <svg className="w-4 h-4 text-cyan-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
            </div>
            <p className="text-2xl font-bold text-cyan-900 leading-none">
              {fmt(ratePerRg)}{" "}
              <span className="text-base font-semibold text-cyan-400">zł</span>
            </p>
            <p className="text-xs text-cyan-500 mt-1.5">netto za roboczogodzinę</p>
          </div>
        )}
      </div>

      {/* Podział wg rozdziałów — wykres kołowy */}
      {chapterData.length > 0 && (
        <div className="rounded-2xl overflow-hidden shadow-sm border border-sky-100/80 bg-white/70 backdrop-blur-sm">
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #7dd3fc, #93c5fd, #c4b5fd)" }} />
          <div className="p-6">
            <SectionHeading color="bg-sky-400">Podział kosztów wg rozdziałów</SectionHeading>
            <ResponsiveContainer width="100%" height={Math.max(360, chapterData.length * 28 + 120)}>
              <PieChart>
                <Pie
                  data={chapterData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  outerRadius="65%"
                  label={({ percent }: { percent?: number }) => percent != null ? `${(percent * 100).toFixed(1)}%` : ""}
                  labelLine={true}
                >
                  {chapterData.map((_, i) => (
                    <Cell key={i} fill={CHAPTER_COLORS[i % CHAPTER_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomPieTooltip />} />
                <Legend
                  formatter={(value: string) => (
                    <span style={{ fontSize: 12, color: "#475569" }}>
                      {value.length > 45 ? value.slice(0, 42) + "…" : value}
                    </span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Top 10 najdroższych pozycji */}
      {top10.length > 0 && (
        <div className="rounded-2xl overflow-hidden shadow-sm border border-amber-100/80 bg-white/70 backdrop-blur-sm">
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #fcd34d, #fdba74, #fca5a5)" }} />
          <div className="p-6">
            <SectionHeading color="bg-amber-400">
              Top {top10.length} najdroższych pozycji kosztorysowych
            </SectionHeading>
            <ResponsiveContainer width="100%" height={top10ChartHeight}>
              <BarChart
                data={top10}
                layout="vertical"
                margin={{ top: 0, right: 80, left: 0, bottom: 0 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v) => new Intl.NumberFormat("pl-PL", { notation: "compact", maximumFractionDigits: 0 }).format(v)}
                  tick={{ fontSize: 11, fill: "#94a3b8" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={220}
                  tick={{ fontSize: 11, fill: "#475569" }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: string) => (v.length > 32 ? v.slice(0, 29) + "…" : v)}
                />
                <Tooltip content={<CustomBarTooltip />} cursor={{ fill: "rgba(186,230,253,0.2)" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} maxBarSize={26}>
                  {top10.map((_, i) => (
                    <Cell
                      key={i}
                      fill={`hsl(${210 + i * 6}, 45%, ${52 - i * 2}%)`}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
