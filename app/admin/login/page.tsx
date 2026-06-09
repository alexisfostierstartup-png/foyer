"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push("/admin/prompts");
        router.refresh();
      } else {
        setError("Mot de passe incorrect.");
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-foyer-cream">
      <div className="w-full max-w-sm px-6">
        <h1 className="font-serif text-2xl text-foyer-ink mb-8 tracking-tight">
          Foyer Admin
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-foyer-muted mb-1.5">
              Mot de passe
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              className="w-full rounded-lg border border-foyer-border bg-white px-3.5 py-2.5 text-foyer-ink text-sm outline-none focus:border-foyer-ink transition-colors"
              placeholder="••••••••"
            />
          </div>
          {error && (
            <p className="text-sm text-foyer-terra">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            className="w-full rounded-lg bg-foyer-ink text-foyer-cream py-2.5 text-sm font-medium transition-opacity disabled:opacity-40"
          >
            {loading ? "Connexion…" : "Connexion"}
          </button>
        </form>
      </div>
    </div>
  );
}
