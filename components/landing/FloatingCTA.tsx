"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function FloatingCTA() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const sentinel = document.getElementById("hero-cta-sentinel");
    if (!sentinel || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  return (
    <div
      className={cn(
        "fixed bottom-[72px] right-9 z-50 transition-all duration-300",
        visible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0",
      )}
    >
      {/* Halo blanc */}
      <div className="rounded-full p-1.5 shadow-[0_0_0_6px_rgba(255,255,255,0.7),0_8px_24px_rgba(107,142,111,0.35)]">
        <Link
          href="/demo"
          className="flex items-center gap-2 rounded-full bg-foyer-sage px-5 py-3 text-[14px] font-semibold text-white transition-all hover:bg-foyer-sage/90"
        >
          Lancer ma transformation
        </Link>
      </div>
    </div>
  );
}
