import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getProject, updateProject } from "@/lib/storage/projects";
import { detectArchitectureAndFurniture } from "@/lib/ai/gemini";
import { generateWowRender } from "@/lib/ai/nano-banana";
import stylesData from "@/data/styles.json";
import type { DetectedFurniture, Project, Style } from "@/lib/types";

const STYLES = stylesData as Style[];

export const maxDuration = 60;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /\b429\b|quota|too many requests/i.test(msg);
}

export async function POST(
  _request: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;

  const project = await getProject(id);
  if (!project) {
    return NextResponse.json({ error: "Projet introuvable" }, { status: 404 });
  }
  if (!project.selectedStyleId) {
    return NextResponse.json(
      { error: "Aucune ambiance sélectionnée" },
      { status: 400 },
    );
  }

  const style = STYLES.find((s) => s.id === project.selectedStyleId);
  if (!style) {
    return NextResponse.json({ error: "Ambiance inconnue" }, { status: 400 });
  }

  // Step 1 — detection (skip if already done)
  let architecture = project.architecture;
  let furniture: DetectedFurniture[] = project.detectedFurniture;

  if (!architecture) {
    try {
      const detection = await detectArchitectureAndFurniture(
        project.basePhotoUrl,
      );
      architecture = detection.architecture;
      furniture = detection.furniture.map((f) => ({
        ...f,
        id: nanoid(),
        decision: "keep" as const,
      }));
      await updateProject(id, {
        architecture,
        detectedFurniture: furniture,
      });
    } catch (err) {
      console.error("[generate] detection failed:", err);
      return NextResponse.json(
        { error: "L'analyse de la pièce a échoué", step: "detection" },
        { status: 503 },
      );
    }
  }

  // Step 2 — WOW render, with a single retry after 2s
  let render: { renderUrl: string; promptUsed: string };
  try {
    render = await generateWowRender({
      sourceImagePath: project.basePhotoUrl,
      architecture,
      furniture,
      style,
      roomType: project.roomType,
    });
  } catch (firstErr) {
    // A quota/429 won't recover from a quick retry — surface it immediately.
    if (isQuotaError(firstErr)) {
      console.error("[generate] quota exceeded:", firstErr);
      return NextResponse.json(
        {
          error:
            "Quota Gemini dépassé — la génération d'image nécessite un plan payant.",
          step: "render",
          reason: "quota",
        },
        { status: 429 },
      );
    }
    console.error("[generate] render attempt 1 failed, retrying in 2s:", firstErr);
    await sleep(2000);
    try {
      render = await generateWowRender({
        sourceImagePath: project.basePhotoUrl,
        architecture,
        furniture,
        style,
        roomType: project.roomType,
      });
    } catch (secondErr) {
      console.error("[generate] render attempt 2 failed:", secondErr);
      if (isQuotaError(secondErr)) {
        return NextResponse.json(
          {
            error:
              "Quota Gemini dépassé — la génération d'image nécessite un plan payant.",
            step: "render",
            reason: "quota",
          },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: "La génération du rendu a échoué", step: "render" },
        { status: 503 },
      );
    }
  }

  const updates: Partial<Project> = { generatedRenderUrl: render.renderUrl };
  await updateProject(id, updates);

  return NextResponse.json({ ok: true, projectId: id });
}
