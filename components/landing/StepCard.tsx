type StepCardProps = {
  number: string;
  title: string;
  description: string;
  withDot?: boolean;
};

export function StepCard({ number, title, description, withDot }: StepCardProps) {
  return (
    <div className="flex flex-1 flex-col rounded-2xl border border-foyer-border bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-foyer-ink/15">
      <div className="flex items-center gap-2">
        {withDot && (
          <span className="size-2 rounded-full bg-foyer-sage" aria-hidden />
        )}
        <span className="font-serif text-2xl text-foyer-terra">{number}</span>
      </div>
      <h3 className="mt-3 font-sans text-lg font-semibold text-foyer-ink">
        {title}
      </h3>
      <p className="mt-2 text-[15px] leading-relaxed text-foyer-muted">
        {description}
      </p>
    </div>
  );
}
