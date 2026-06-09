import { NextRequest, NextResponse } from "next/server";
import { resolveRawTemplate } from "@/lib/prompts/engine";
import {
  loadStyleContext,
  loadRoomDefaults,
  formatUserInstructions,
  type UserChoicesInput,
} from "@/lib/prompts/helpers";
import { getImageProvider, getVisionProvider } from "@/lib/ai/provider";
import type { ResolveContext } from "@/lib/prompts/types";

const IMAGE_PROVIDERS = new Set(["nano_banana", "flux_kontext"]);

type TestBody = {
  promptTemplate: string;
  provider: string;
  purpose: string;
  context?: {
    styleId?: string;
    roomType?: string;
    visionJsonOverride?: unknown;
    choices?: UserChoicesInput;
    userRequest?: string;
    [key: string]: unknown;
  };
  sourceImage?: { base64: string; mimeType: string };
};

export async function POST(req: NextRequest) {
  let body: TestBody;
  try {
    body = (await req.json()) as TestBody;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const { promptTemplate, provider, context = {}, sourceImage } = body;

  if (!promptTemplate) {
    return NextResponse.json({ ok: false, error: "promptTemplate is required" }, { status: 400 });
  }
  if (!provider) {
    return NextResponse.json({ ok: false, error: "provider is required" }, { status: 400 });
  }

  try {
    // ── Build ResolveContext from high-level context ──────────────────────
    const ctx: ResolveContext = {};

    if (context.styleId) {
      const s = await loadStyleContext(context.styleId);
      ctx.styleName = s.styleName;
      ctx.styleMood = s.styleMood;
    }

    if (context.roomType) {
      ctx.roomType = context.roomType;
      ctx.furnitureDefaults = await loadRoomDefaults(context.roomType);
    }

    if (context.visionJsonOverride !== undefined) {
      ctx.visionJson =
        typeof context.visionJsonOverride === "string"
          ? context.visionJsonOverride
          : JSON.stringify(context.visionJsonOverride, null, 2);
    }

    if (context.choices) {
      ctx.userInstructions = await formatUserInstructions(context.choices);
    }

    if (context.userRequest) {
      ctx.userRequest = context.userRequest;
    }

    // Pass through other free-form keys
    for (const [k, v] of Object.entries(context)) {
      if (!["styleId", "roomType", "visionJsonOverride", "choices", "userRequest"].includes(k)) {
        ctx[k] = v;
      }
    }

    // ── Substitute variables ──────────────────────────────────────────────
    const { resolved, missing } = resolveRawTemplate(promptTemplate, ctx);

    // ── Call provider ─────────────────────────────────────────────────────
    if (IMAGE_PROVIDERS.has(provider)) {
      const imageProvider = getImageProvider(provider);
      const imageInput = sourceImage
        ? { base64: sourceImage.base64, mimeType: sourceImage.mimeType }
        : undefined;
      const result = await imageProvider.generateFromText(resolved, imageInput);

      return NextResponse.json({
        ok: true,
        type: "image",
        dataUrl: `data:${result.mimeType};base64,${result.imageBuffer.toString("base64")}`,
        durationMs: result.durationMs,
        bytes: result.imageBuffer.length,
        resolvedTemplate: resolved,
        missing,
      });
    } else {
      const visionProvider = getVisionProvider(provider);
      const images = sourceImage
        ? [{ base64: sourceImage.base64, mimeType: sourceImage.mimeType }]
        : [];
      const result = await visionProvider.analyze(resolved, images);

      return NextResponse.json({
        ok: true,
        type: "vision",
        text: result.text,
        parsed: result.parsed,
        durationMs: result.durationMs,
        resolvedTemplate: resolved,
        missing,
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
