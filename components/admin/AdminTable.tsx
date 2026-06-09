import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
};

type Props<T extends { id: string }> = {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
};

export function AdminTable<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  emptyMessage = "Aucun enregistrement.",
}: Props<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-foyer-border px-6 py-12 text-center text-sm text-foyer-muted">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-foyer-border overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-foyer-border bg-foyer-border/30">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-2.5 text-left text-xs font-medium text-foyer-muted uppercase tracking-wide"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-foyer-border">
          {rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onRowClick?.(row)}
              className={`transition-colors ${
                onRowClick
                  ? "cursor-pointer hover:bg-foyer-border/30"
                  : ""
              }`}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-foyer-ink">
                  {col.render
                    ? col.render(row)
                    : String((row as Record<string, unknown>)[col.key] ?? "—")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
