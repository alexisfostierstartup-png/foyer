"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import type { DiyAction } from "@/lib/diy/types";

type Props = {
  actions: DiyAction[];
};

export function DiyActionsAdmin({ actions: initialActions }: Props) {
  const router = useRouter();
  const [actions, setActions] = useState(initialActions);
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const filtered = actions.filter(
    (a) =>
      !search ||
      a.label.toLowerCase().includes(search.toLowerCase()) ||
      a.slug.includes(search.toLowerCase()),
  );

  async function toggleActive(action: DiyAction) {
    const res = await fetch(`/api/admin/diy-actions/${action.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !action.is_active }),
    });
    if (res.ok) {
      setActions((prev) =>
        prev.map((a) =>
          a.id === action.id ? { ...a, is_active: !a.is_active } : a,
        ),
      );
    }
  }

  async function deleteAction(id: string) {
    if (!confirm("Supprimer cette action ?")) return;
    const res = await fetch(`/api/admin/diy-actions/${id}`, { method: "DELETE" });
    if (res.ok) {
      setActions((prev) => prev.filter((a) => a.id !== id));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-foyer-ink">Actions DIY</h1>
          <p className="text-sm text-foyer-muted mt-1">
            {actions.length} actions dans la bibliothèque
          </p>
        </div>
        <Link
          href="/admin/diy-actions/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-foyer-ink text-foyer-cream text-sm rounded-lg"
        >
          <Plus size={15} />
          Nouvelle action
        </Link>
      </div>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Rechercher…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-sm px-3 py-2 text-sm border border-foyer-border rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-foyer-ink"
        />
      </div>

      <div className="rounded-xl border border-foyer-border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-foyer-border/40">
            <tr>
              <th className="text-left px-4 py-3 text-foyer-muted font-medium">Slug / Libellé</th>
              <th className="text-left px-4 py-3 text-foyer-muted font-medium hidden md:table-cell">Catégories</th>
              <th className="text-left px-4 py-3 text-foyer-muted font-medium hidden lg:table-cell">Unité</th>
              <th className="text-center px-4 py-3 text-foyer-muted font-medium">Actif</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-foyer-border">
            {filtered.map((action) => (
              <tr
                key={action.id}
                className={`hover:bg-foyer-border/20 transition-colors ${
                  !action.is_active ? "opacity-50" : ""
                }`}
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-foyer-ink">{action.label}</p>
                  <p className="text-xs text-foyer-muted font-mono">{action.slug}</p>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {action.applies_to_categories.slice(0, 3).map((c) => (
                      <span
                        key={c}
                        className="px-1.5 py-0.5 text-[10px] bg-foyer-border rounded text-foyer-muted"
                      >
                        {c}
                      </span>
                    ))}
                    {action.applies_to_categories.length > 3 && (
                      <span className="text-[10px] text-foyer-muted">
                        +{action.applies_to_categories.length - 3}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-foyer-muted hidden lg:table-cell">
                  {action.qty_unit ?? "—"}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => toggleActive(action)}
                    className="text-foyer-muted hover:text-foyer-ink transition-colors"
                    aria-label={action.is_active ? "Désactiver" : "Activer"}
                  >
                    {action.is_active ? (
                      <ToggleRight size={20} className="text-foyer-sage" />
                    ) : (
                      <ToggleLeft size={20} />
                    )}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2 justify-end">
                    <Link
                      href={`/admin/diy-actions/${action.id}`}
                      className="p-1.5 text-foyer-muted hover:text-foyer-ink rounded transition-colors"
                    >
                      <Pencil size={15} />
                    </Link>
                    <button
                      onClick={() => deleteAction(action.id)}
                      className="p-1.5 text-foyer-muted hover:text-red-500 rounded transition-colors"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-foyer-muted text-sm">
                  Aucune action trouvée
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
