import { NextResponse } from "next/server";

// POST /api/generate — generates the styled render (Nano Banana) while
// preserving the room architecture. Implemented in a later phase.
export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    { error: "Not implemented yet" },
    { status: 501 },
  );
}
