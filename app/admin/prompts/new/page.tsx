import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { PromptEditorForm } from "@/components/admin/PromptEditorForm";

export default function NewPromptPage() {
  return (
    <div>
      <Link
        href="/admin/prompts"
        className="inline-flex items-center gap-1.5 text-sm text-foyer-muted hover:text-foyer-ink mb-6 transition-colors"
      >
        <ChevronLeft size={16} />
        Prompts
      </Link>

      <PromptEditorForm />
    </div>
  );
}
