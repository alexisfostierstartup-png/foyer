import { NextRequest, NextResponse } from "next/server";
import { integratePieceOnRender } from "@/lib/ai/expert";
import { logPipelineError } from "@/lib/ai/logger";
import { isTransientAiError } from "@/lib/ai/retry";
import { getClientIp, checkRateLimit, RATE_LIMITED_BODY } from "@/lib/security/rateLimit";

// Le swap NB2 d'une pièce tient largement dans ce budget (1 génération).
export const maxDuration = 300; // plafond Fluid Compute — à 90 s, le calcul liste+pins en prod (vision + Jina froid + matching, parfois >90 s) était tué en plein vol et bouclait (QA Alexis 2026-07-17)

// « Intégrer ce meuble » (flux gratuit, /final) : le user choisit UN produit précis
// d'une ligne → le rendu est régénéré avec CE produit incrusté (avant-goût du mode
// expert offert — demande Alexis 2026-07-16). Un seul élément par appel : le geste
// est unitaire côté UI, et une pièce = une passe NB2 (pas d'accumulation ici — le
// mode expert garde son propre flux d'overrides groupés).
export async function POST(
  request: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  if (!(await checkRateLimit(getClientIp(request), "generate", 20))) {
    return NextResponse.json(RATE_LIMITED_BODY, { status: 429 });
  }

  let elementId: string, productId: string;
  try {
    const body = (await request.json()) as { elementId?: string; productId?: string };
    if (!body.elementId || !body.productId) throw new Error("champs manquants");
    elementId = body.elementId;
    productId = body.productId;
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  try {
    const renderUrl = await integratePieceOnRender(id, elementId, productId);
    return NextResponse.json({ ok: true, renderUrl });
  } catch (err) {
    console.error("[integrate-piece] échec:", err);
    await logPipelineError(id, "integrate-piece", err);
    const message = isTransientAiError(err)
      ? "Le service IA est très demandé en ce moment. Réessayez dans quelques instants."
      : "L'intégration du meuble a échoué. Réessayez.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
