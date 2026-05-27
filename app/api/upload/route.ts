import { NextResponse } from "next/server";

// POST /api/upload — receives a room photo, resizes it (sharp) and stores it
// under /public/uploads. Returns the public URL. Implemented in a later phase.
export async function POST(request: Request) {
  void request;
  return NextResponse.json(
    { error: "Not implemented yet" },
    { status: 501 },
  );
}
