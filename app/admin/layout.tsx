import { Sidebar } from "@/components/admin/Sidebar";
import type { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-foyer-cream">
      <Sidebar />
      <main className="md:pl-56">
        <div className="px-6 py-8">{children}</div>
      </main>
    </div>
  );
}
