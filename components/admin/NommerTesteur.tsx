"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Champ « Nommer » d'un groupe visiteur/compte : tague tous ses projets. */
export function NommerTesteur({ anonId, userId }: { anonId?: string; userId?: string }) {
  const router = useRouter();
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);

  async function nommer() {
    if (!val.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/tester-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: val.trim(), anonId, userId }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && nommer()}
        placeholder="prénom…"
        className="h-7 w-28 rounded border border-foyer-border bg-white px-2 text-[13px] outline-none focus:border-foyer-sage"
      />
      <button
        type="button"
        onClick={nommer}
        disabled={busy || !val.trim()}
        className="h-7 rounded bg-foyer-sage px-2.5 text-[13px] font-medium text-white disabled:opacity-50"
      >
        {busy ? "…" : "Nommer"}
      </button>
    </span>
  );
}
