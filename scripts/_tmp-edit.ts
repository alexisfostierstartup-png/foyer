import { config } from "dotenv"; config({ path: ".env.local" });
import { getImageProvider } from "../lib/ai/provider";
import { createSupabaseAdmin } from "../lib/supabase/server";
import { writeFile } from "fs/promises";

// Cadrage ÉDITION STRICTE (comme /iterate, qui n'invente JAMAIS de fenêtre) au lieu de
// REDESIGN. On garde une demande de style FORTE pour ne pas retomber dans le "timide".
const PROMPT = `This is a strict EDIT of the attached photograph, NOT a new image. The photo is a real Parisian living room.

ABSOLUTE RULE — THE ROOM ITSELF DOES NOT CHANGE: keep every wall, every window, every door, the ceiling and its rose, the parquet floor, the alcoves and mouldings EXACTLY as they are, pixel-faithful, same positions, same count. You are FORBIDDEN to add a window, a door or any opening on any wall — the back wall and right wall have NONE and must stay blank. If a wall is bare, it stays bare.

WHAT YOU CHANGE, boldly and fully — a committed BOHÈME restyle: repaint the walls in a warm bohème colour, replace the movable furniture with genuine bohème pieces, add a large patterned rug, layered textiles, macramé, plants, rattan, dressed shelves. Full magazine-quality bohème ambiance. Tidy away any clutter (clothes rack, boxes). Keep the kept sofa's silhouette.

Same camera, same framing, same viewpoint. Photorealistic daylight photograph.`;

async function main() {
  const sb = createSupabaseAdmin() as any;
  const { data } = await sb.from("foyer_projects").select("data").eq("id","Es76ucyOwBHFqg499NEdg").single();
  const photoUrl = data.data.basePhotoUrl;
  const buf = Buffer.from(await (await fetch(photoUrl)).arrayBuffer());
  const out = await getImageProvider("nano_banana").editImage(PROMPT, buf as never);
  await writeFile("/private/tmp/claude-501/-Users-alexis/0866e850-c0a9-4cc1-844f-3383aa9e2c43/scratchpad/edit_test.png", out.imageBuffer);
  console.log("OK — rendu édition stricte écrit");
}
main();
