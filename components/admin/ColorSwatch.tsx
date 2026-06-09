type Props = { hex: string; size?: number };

export function ColorSwatch({ hex, size = 20 }: Props) {
  return (
    <span
      className="inline-block rounded border border-foyer-border/50 shrink-0"
      style={{ width: size, height: size, backgroundColor: hex }}
      title={hex}
    />
  );
}
