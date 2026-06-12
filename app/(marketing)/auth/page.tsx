"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { signIn, signUp } from "@/lib/auth/actions";

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<"signin" | "signup">(
    params.get("tab") === "signup" ? "signup" : "signin",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const next = params.get("next") ?? "/create";

  async function handleSubmit() {
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      if (mode === "signup") {
        const result = await signUp(email, password, name || undefined);
        if (result.error) { setError(result.error); setLoading(false); return; }
      } else {
        const result = await signIn(email, password);
        if (result.error) { setError(result.error); setLoading(false); return; }
      }
      router.push(next);
      router.refresh();
    } catch {
      setError("Une erreur inattendue est survenue. Réessayez.");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-foyer-border bg-foyer-cream px-4 py-3 text-[14px] text-foyer-ink outline-none placeholder:text-foyer-muted focus:border-foyer-sage transition-colors";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-foyer-cream px-6 py-12">
      {/* Logo */}
      <Link
        href="/"
        className="mb-10 font-serif text-[22px] tracking-tight text-foyer-ink"
      >
        Foyer
      </Link>

      <div className="w-full max-w-[420px] rounded-3xl bg-white p-8 shadow-[0_20px_60px_rgba(31,27,22,0.08)] ring-1 ring-foyer-border/50 md:p-10">
        {/* Tabs */}
        <div className="mb-7 flex border-b border-foyer-border">
          {(
            [
              ["signin", "Se connecter"],
              ["signup", "Créer un compte"],
            ] as const
          ).map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setMode(t);
                setError("");
              }}
              className={cn(
                "flex-1 pb-3 text-[13px] transition-colors",
                mode === t
                  ? "-mb-px border-b-2 border-foyer-sage font-semibold text-foyer-sage"
                  : "font-medium text-foyer-muted hover:text-foyer-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          {mode === "signup" && (
            <div>
              <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.08em] text-foyer-muted">
                Nom complet
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Camille Dupont"
                className={inputClass}
              />
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.08em] text-foyer-muted">
              Adresse email
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              placeholder="camille@example.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[12px] font-medium uppercase tracking-[0.08em] text-foyer-muted">
              Mot de passe
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className={inputClass}
            />
          </div>
        </div>

        {error && (
          <p className="mt-3 text-[12px] text-red-600">{error}</p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading}
          className={cn(
            "mt-6 w-full rounded-full py-3 text-[14px] font-semibold transition-colors",
            loading
              ? "cursor-default bg-foyer-muted text-white"
              : "bg-foyer-sage text-white shadow-[0_2px_8px_rgba(107,142,111,0.35)] hover:bg-foyer-sage/90",
          )}
        >
          {loading
            ? "Chargement…"
            : mode === "signin"
              ? "Se connecter →"
              : "Créer mon compte →"}
        </button>

        <div className="mt-5 rounded-xl border border-foyer-border bg-foyer-cream px-4 py-3">
          <p className="text-[11px] leading-relaxed text-foyer-muted">
            Aucun frais avant votre premier projet · Données sécurisées · 100% Foyer
          </p>
        </div>
      </div>

      <Link
        href="/"
        className="mt-6 text-[12px] text-foyer-muted transition-colors hover:text-foyer-ink"
      >
        ← Retour à l'accueil
      </Link>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthForm />
    </Suspense>
  );
}
