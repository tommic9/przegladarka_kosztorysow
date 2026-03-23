import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ContractorNav from "@/components/ContractorNav";

export default async function ContractorLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session || session.role !== "contractor") redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50">
      <ContractorNav userName={session.name} />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
