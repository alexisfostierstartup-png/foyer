"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Client = { id: string; name: string; email?: string | null; phone?: string | null; notes?: string | null };

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/pro/clients").then((r) => r.json()).then((d: Client[]) => { setClients(d ?? []); setLoading(false); });
  }, []);

  async function handleCreate() {
    if (!name) { toast.error("Le nom est requis."); return; }
    setSaving(true);
    const res = await fetch("/api/pro/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email: email || undefined, phone: phone || undefined }),
    });
    if (!res.ok) { toast.error("Erreur."); setSaving(false); return; }
    const created = (await res.json()) as Client;
    setClients((p) => [created, ...p]);
    setName(""); setEmail(""); setPhone(""); setShowForm(false);
    setSaving(false);
    toast.success("Client ajouté !");
  }

  async function handleDelete(id: string) {
    await fetch(`/api/pro/clients/${id}`, { method: "DELETE" });
    setClients((p) => p.filter((c) => c.id !== id));
    toast.success("Supprimé.");
  }

  const inputClass = "w-full rounded-xl border border-foyer-border bg-foyer-cream px-4 py-2.5 text-[13px] text-foyer-ink outline-none focus:border-foyer-sage";

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-serif text-[24px] font-medium text-foyer-ink">Clients</h1>
        <button
          type="button"
          onClick={() => setShowForm((p) => !p)}
          className="flex items-center gap-1.5 rounded-full bg-foyer-sage px-4 py-2 text-[13px] font-semibold text-white shadow-[0_2px_8px_rgba(107,142,111,0.3)]"
        >
          <Plus className="size-3.5" />
          Nouveau client
        </button>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-foyer-border bg-foyer-cream p-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom *" className={inputClass} />
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className={inputClass} />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone" className={inputClass} />
          </div>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-full bg-foyer-sage px-4 py-2 text-[13px] font-medium text-white"
            >
              {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
              Enregistrer
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-full px-4 py-2 text-[13px] text-foyer-muted">
              Annuler
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="size-6 animate-spin text-foyer-muted" /></div>
      ) : clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-foyer-border bg-foyer-cream px-6 py-16 text-center">
          <Users className="mx-auto mb-3 size-8 text-foyer-muted/40" />
          <p className="text-[14px] text-foyer-muted">Aucun client pour l'instant.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-foyer-border bg-foyer-cream">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-foyer-border bg-foyer-cream/60">
                <th className="px-4 py-3 text-left font-semibold text-foyer-muted">Nom</th>
                <th className="hidden px-4 py-3 text-left font-semibold text-foyer-muted sm:table-cell">Email</th>
                <th className="hidden px-4 py-3 text-left font-semibold text-foyer-muted md:table-cell">Téléphone</th>
                <th className="px-4 py-3 text-right font-semibold text-foyer-muted">Action</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c, i) => (
                <tr key={c.id} className={i < clients.length - 1 ? "border-b border-foyer-border" : ""}>
                  <td className="px-4 py-3 font-medium text-foyer-ink">{c.name}</td>
                  <td className="hidden px-4 py-3 text-foyer-muted sm:table-cell">{c.email ?? "—"}</td>
                  <td className="hidden px-4 py-3 text-foyer-muted md:table-cell">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => handleDelete(c.id)} className="text-foyer-muted hover:text-red-500">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
