"use client";

import { useState } from "react";

type Settlement = {
  id: number;
  project_id: number;
  contractor_id: number;
  contractor_name: string;
  contractor_email?: string;
  description: string;
  amount: number;
  status: "pending" | "paid";
  created_at: string;
};

type Contractor = { id: number; name: string; email: string };

function fmt(n: number): string {
  return new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export default function SettlementsManager({
  projectId,
  initialSettlements,
  contractors,
}: {
  projectId: number;
  initialSettlements: Settlement[];
  contractors: Contractor[];
}) {
  const [settlements, setSettlements] = useState<Settlement[]>(initialSettlements);
  const [contractorId, setContractorId] = useState(contractors[0]?.id.toString() ?? "");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!contractorId || !description || !amount) return;

    setSaving(true);
    const res = await fetch(`/api/projects/${projectId}/settlements`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contractor_id: parseInt(contractorId, 10),
        description,
        amount: parseFloat(amount),
      }),
    });

    if (res.ok) {
      const data = await res.json() as { settlement: Settlement };
      setSettlements((prev) => [data.settlement, ...prev]);
      setDescription("");
      setAmount("");
    }
    setSaving(false);
  }

  async function toggleStatus(s: Settlement) {
    const next = s.status === "pending" ? "paid" : "pending";
    const res = await fetch(`/api/settlements/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (res.ok) {
      setSettlements((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, status: next } : x))
      );
    }
  }

  async function handleDelete(id: number) {
    const res = await fetch(`/api/settlements/${id}`, { method: "DELETE" });
    if (res.ok) {
      setSettlements((prev) => prev.filter((s) => s.id !== id));
    }
  }

  return (
    <div>
      {contractors.length === 0 ? (
        <p className="text-sm text-gray-400 mb-4">Brak wykonawców przypisanych do projektu.</p>
      ) : (
        <form onSubmit={handleAdd} className="grid grid-cols-1 gap-2 mb-4">
          <select
            value={contractorId}
            onChange={(e) => setContractorId(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          >
            {contractors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.email})
              </option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Opis pozycji"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
          />
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Kwota (zł)"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              step="0.01"
              min="0"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <button type="submit" disabled={saving} className="btn btn-primary btn-sm">
              {saving ? "…" : "Dodaj"}
            </button>
          </div>
        </form>
      )}

      {settlements.length === 0 ? (
        <p className="text-sm text-gray-400">Brak pozycji rozliczeniowych.</p>
      ) : (
        <div className="space-y-2">
          {settlements.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900">{s.description}</p>
                <p className="text-xs text-gray-500">{s.contractor_name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-semibold tabular-nums">{fmt(s.amount)} zł</span>
                <button
                  onClick={() => toggleStatus(s)}
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${
                    s.status === "paid"
                      ? "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
                      : "bg-yellow-50 border-yellow-200 text-yellow-700 hover:bg-yellow-100"
                  }`}
                >
                  {s.status === "paid" ? "Zapłacone" : "Do zapłaty"}
                </button>
                <button
                  onClick={() => handleDelete(s.id)}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Usuń
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
