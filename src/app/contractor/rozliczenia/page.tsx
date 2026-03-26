import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import db from "@/lib/db";

function fmt(n: number): string {
  return new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default async function ContractorRozliczeniaPage() {
  const session = await getSession();
  if (!session || session.role !== "contractor") redirect("/login");

  const settlements = db
    .prepare(
      `SELECT s.*, p.title as project_title
       FROM settlements s
       JOIN projects p ON p.id = s.project_id
       WHERE s.contractor_id = ?
       ORDER BY s.created_at DESC`
    )
    .all(session.userId) as {
    id: number;
    project_title: string;
    description: string;
    amount: number;
    status: "pending" | "paid";
    created_at: string;
  }[];

  const totalPending = settlements
    .filter((s) => s.status === "pending")
    .reduce((sum, s) => sum + s.amount, 0);

  const totalPaid = settlements
    .filter((s) => s.status === "paid")
    .reduce((sum, s) => sum + s.amount, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Rozliczenia</h1>

      {settlements.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center mt-6">
          <p className="text-gray-500">Brak pozycji rozliczeniowych.</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="flex gap-4 mb-6 flex-wrap">
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-5 py-3">
              <p className="text-xs text-yellow-600 mb-0.5">Do zapłaty</p>
              <p className="text-xl font-bold text-yellow-800">{fmt(totalPending)} zł</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-xl px-5 py-3">
              <p className="text-xs text-green-600 mb-0.5">Zapłacone</p>
              <p className="text-xl font-bold text-green-800">{fmt(totalPaid)} zł</p>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Projekt</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">Opis</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Kwota</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {settlements.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.project_title}</td>
                    <td className="px-4 py-3 text-gray-600">{s.description}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-900">
                      {fmt(s.amount)} zł
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-block text-xs px-2.5 py-0.5 rounded-full border font-medium ${
                          s.status === "paid"
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-yellow-50 border-yellow-200 text-yellow-700"
                        }`}
                      >
                        {s.status === "paid" ? "Zapłacone" : "Do zapłaty"}
                      </span>
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
