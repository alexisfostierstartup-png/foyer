import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DiyActionEditorForm } from "@/components/admin/DiyActionEditorForm";

export default function NewDiyActionPage() {
  return (
    <div>
      <Link
        href="/admin/diy-actions"
        className="inline-flex items-center gap-1.5 text-sm text-foyer-muted hover:text-foyer-ink mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        Actions DIY
      </Link>
      <h1 className="font-serif text-2xl text-foyer-ink mb-6">Nouvelle action</h1>
      <DiyActionEditorForm />
    </div>
  );
}
