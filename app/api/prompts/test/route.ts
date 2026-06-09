import { NextRequest, NextResponse } from "next/server";
import { resolvePrompt } from "@/lib/prompts/engine";
import {
  loadStyleContext,
  loadRoomDefaults,
  formatUserInstructions,
  type UserChoicesInput,
} from "@/lib/prompts/helpers";
import type { ResolveContext } from "@/lib/prompts/types";

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    slug: string;
    styleId?: string;
    roomType?: string;
    visionJson?: unknown;
    choices?: UserChoicesInput;
    [key: string]: unknown;
  };

  try {
    const ctx: ResolveContext = {};

    if (body.styleId) {
      const s = await loadStyleContext(body.styleId);
      ctx.styleName = s.styleName;
      ctx.styleMood = s.styleMood;
    }

    if (body.roomType) {
      ctx.roomType = body.roomType;
      ctx.furnitureDefaults = await loadRoomDefaults(body.roomType);
    }

    if (body.visionJson !== undefined) {
      ctx.visionJson =
        typeof body.visionJson === "string"
          ? body.visionJson
          : JSON.stringify(body.visionJson, null, 2);
    }

    if (body.choices) {
      ctx.userInstructions = await formatUserInstructions(body.choices);
    }

    // Passe-plat des autres clés libres (ex: userRequest pour iterate)
    for (const [k, v] of Object.entries(body)) {
      if (!["slug", "styleId", "roomType", "visionJson", "choices"].includes(k)) {
        ctx[k] = v;
      }
    }

    const r = await resolvePrompt(body.slug, ctx, { strict: false });

    return NextResponse.json({
      ok: true,
      promptSlug: r.prompt.slug,
      provider: r.prompt.provider,
      version: r.prompt.version,
      missing: r.missingVariables,
      used: r.usedVariables,
      resolvedTemplate: r.resolvedTemplate,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
