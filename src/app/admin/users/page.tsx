import db from "@/lib/db";
import UserManager from "@/components/UserManager";

export default function AdminUsersPage() {
  const users = db
    .prepare("SELECT id, email, name, created_at FROM users WHERE role = 'contractor' ORDER BY name")
    .all() as { id: number; email: string; name: string; created_at: string }[];

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Wykonawcy</h1>
      <UserManager initialUsers={users} />
    </div>
  );
}
