import { NextRequest, NextResponse } from "next/server";
import { getImageProvider, getVisionProvider } from "@/lib/ai/provider";

export async function POST(req: NextRequest) {
  const { providerType, providerName, prompt } = (await req.json()) as {
    providerType: "image" | "vision";
    providerName: string;
    prompt: string;
  };

  try {
    if (providerType === "vision") {
      const r = await getVisionProvider(providerName).analyze(prompt, []);
      return NextResponse.json({
        ok: true,
        text: r.text,
        parsed: r.parsed,
        durationMs: r.durationMs,
      });
    } else {
      const r = await getImageProvider(providerName).generateFromText(prompt);
      return NextResponse.json({
        ok: true,
        providerUsed: r.providerUsed,
        mimeType: r.mimeType,
        durationMs: r.durationMs,
        bytes: r.imageBuffer.length,
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
