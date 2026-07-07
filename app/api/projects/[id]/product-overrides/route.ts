import { NextRequest, NextResponse } from "next/server";
import { runExpertRenderPipeline } from "@/lib/ai/expert";
import { updateProject } from "@/lib/storage/projects";
import type { CustomProduct } from "@/lib/types";
import { logPipelineError } from "@/lib/ai/logger";
import { isTransientAiError } from "@/lib/ai/retry";
import { getClientIp, checkRateLimit, RATE_LIMITED_BODY } from "@/lib/security/rateLimit";

export const maxDuration = 90;

// Option « liste de courses alternative » : l'user a choisi des produits alternatifs
// pour un ou plusieurs éléments (elementId → index dans matches). On persiste TOUS
// les choix d'un coup puis on relance UN SEUL rendu expert (pas un rendu par modif).
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  if (!(await checkRateLimit(getClientIp(request), "generate", 20))) {
    return NextResponse.json(RATE_LIMITED_BODY, { status: 429 });
  }

  let overrides: Record<string, number>;
  let customProducts: Record<string, CustomProduct> = {};
  try {
    const body = (await request.json()) as {
      overrides?: Record<string, number>;
      customProducts?: Record<string, CustomProduct>;
    };
    overrides = body.overrides ?? {};
    customProducts = body.customProducts ?? {};
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }
  // Garde-fou : seulement des index numériques ≥ 0.
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(overrides)) {
    if (typeof v === "number" && Number.isInteger(v) && v >= 0) clean[k] = v;
  }
  // Garde-fou custom : imageUrl http(s) obligatoire.
  const cleanCustom: Record<string, CustomProduct> = {};
  for (const [k, v] of Object.entries(customProducts)) {
    if (v && typeof v.imageUrl === "string" && /^https?:\/\//.test(v.imageUrl)) {
      cleanCustom[k] = { imageUrl: v.imageUrl, name: v.name ?? null, price: v.price ?? null, url: v.url ?? null, merchant: v.merchant ?? null };
    }
  }

  try {
    await updateProject(id, { productOverrides: clean, customProducts: cleanCustom });
    const url = await runExpertRenderPipeline(id);
    return NextResponse.json({ ok: true, projectId: id, expertRenderUrl: url });
  } catch (err) {
    console.error("[product-overrides] error:", err);
    await logPipelineError(id, "product-overrides", err);
    const msg = err instanceof Error ? err.message : String(err);
    if (/photo de base|gros meuble|Project not found/.test(msg)) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const message = isTransientAiError(err)
      ? "Le service IA est très demandé. Réessayez dans quelques instants."
      : "Le nouveau rendu a échoué. Réessayez.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
