import { NextResponse } from "next/server";

// POST /api/detect — runs Gemini Vision on a room photo to detect existing
// furniture and the room architecture. Implemented in a later phase.
export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    { error: "Not implemented yet" },
    { status: 501 },
  );
}
