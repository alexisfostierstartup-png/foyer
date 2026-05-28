type PartnerCardProps = {
  title: string;
  promise: string;
  examples: string;
};

export function PartnerCard({ title, promise, examples }: PartnerCardProps) {
  return (
    <div className="flex flex-1 flex-col rounded-2xl border border-foyer-border bg-white p-6">
      <h3 className="font-sans text-lg font-semibold text-foyer-ink">{title}</h3>
      <p className="mt-2 flex-1 text-[15px] leading-relaxed text-foyer-muted">
        {promise}
      </p>
      <p className="mt-4 text-[13px] text-foyer-muted">
        <span className="text-foyer-ink/70">ex.</span> {examples}
      </p>
    </div>
  );
}
