type SourcedTone = "sage" | "terra";

const DOT_CLASS: Record<SourcedTone, string> = {
  sage: "bg-foyer-sage",
  terra: "bg-foyer-terra",
};

type SourcedItemProps = {
  tone: SourcedTone;
  name: string;
  detail: string;
  price: string;
};

export function SourcedItem({ tone, name, detail, price }: SourcedItemProps) {
  return (
    <li className="flex items-start gap-3 border-b border-foyer-border py-3 last:border-b-0">
      <span
        className={`mt-1.5 size-2.5 shrink-0 rounded-full ${DOT_CLASS[tone]}`}
        aria-hidden
      />
      <div className="flex flex-1 flex-wrap items-baseline justify-between gap-x-3">
        <div>
          <p className="text-[15px] font-medium text-foyer-ink">{name}</p>
          <p className="text-[13px] text-foyer-muted">{detail}</p>
        </div>
        <span className="text-[15px] font-medium text-foyer-ink">{price}</span>
      </div>
    </li>
  );
}
