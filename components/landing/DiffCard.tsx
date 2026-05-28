import type { LucideIcon } from "lucide-react";

type DiffTone = "terra" | "ink" | "sage" | "water";

const DOT_CLASS: Record<DiffTone, string> = {
  terra: "bg-foyer-terra",
  ink: "bg-foyer-ink",
  sage: "bg-foyer-sage",
  water: "bg-foyer-water",
};

type DiffCardProps = {
  icon: LucideIcon;
  tone: DiffTone;
  title: string;
  description: string;
};

export function DiffCard({ icon: Icon, tone, title, description }: DiffCardProps) {
  return (
    <div className="group flex flex-1 flex-col rounded-2xl border border-foyer-border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-foyer-ink/15">
      <div className="flex items-center justify-between">
        <Icon className="size-6 text-foyer-ink" strokeWidth={1.5} aria-hidden />
        <span
          className={`size-2.5 rounded-full ${DOT_CLASS[tone]} transition-transform duration-300 group-hover:scale-150`}
          aria-hidden
        />
      </div>
      <h3 className="mt-4 font-sans text-lg font-semibold text-foyer-ink">
        {title}
      </h3>
      <p className="mt-2 text-[15px] leading-relaxed text-foyer-muted">
        {description}
      </p>
    </div>
  );
}
