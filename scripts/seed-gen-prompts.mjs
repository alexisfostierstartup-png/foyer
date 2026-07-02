// Source de vérité des PROMPTS DE GÉNÉRATION (table `prompts`, sinon éditée via
// /admin/prompts). Les règles anti-hallucination (préservation des fixtures, TV
// moderne, éclairage) sont GÉNÉRALES → définies UNE seule fois dans SHARED_RULES
// et injectées dans les deux prompts pour éviter le drift. La seule différence
// voulue entre les deux : gen_wow_3_dispositions a une surcouche "TARGET LAYOUT"
// (3 dispositions distinctes) ; gen_wow_generic est le rendu unique piloté par le
// plan. Modifier une règle commune = éditer SHARED_RULES + relancer ce script.
//
// Usage: node scripts/seed-gen-prompts.mjs
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ─── Règles communes (anti-hallucination) — UNE seule définition ─────────────
const SHARED_RULES = `- Lighting — the room has a FIXED set of electrical light points. REPLACE the fixture at each EXISTING point with a {{styleName}}-style luminaire hung from the EXACT same point (e.g. swap a bare hanging bulb for a style pendant in the very same spot): this in-place swap is expected and good. But never add a ceiling or wall light BEYOND the existing point(s) — no second luminaire beside or offset from an existing point, and never invent a new light point where the original has none (new wiring is contractor work to avoid). If the scene needs more light, add only MOVABLE floor or table lamps that plug into a wall socket.
- Never paint, recolor or restyle a radiator or a water heater (chauffe-eau) — keep them exactly as in the original photo. NEVER replace a radiator, water heater or staircase with furniture, nor cover, hide or merge it into a shelf, cabinet or unit — each fixed fixture stays the SAME object, on the same wall, and the wall area it occupies stays clear of any new furniture or shelving.
- Technology stays present-day: render any TV or screen as a MODERN flat-screen — never a vintage CRT / cathode-ray / tube TV. The "{{styleName}}" style governs decor, materials and furniture shapes only, NOT the era of electronics or appliances.`;

// ─── Rendu unique (piloté par le plan) ───────────────────────────────────────
const GEN_WOW_GENERIC = `You are a professional interior designer. Redesign the attached room photo into a photorealistic {{roomType}} in the "{{styleName}}" style (mood: {{styleMood}}).

=== WHAT TO CHANGE — follow this plan literally ===
{{designPlan}}

How to apply the plan:
- REPLACE <item>: the original <item> must be GONE from the result. Put a clearly different piece, in the {{styleName}} style, in the SAME spot (same footprint, scale and position). Keeping it, or merely recoloring/recovering it, is wrong.
- RESTYLE <item>: valid ONLY for walls (repaint) and floor (refinish). NEVER apply RESTYLE to a piece of furniture — if furniture is listed as RESTYLE, REPLACE it instead. FLOOR: only when the plan explicitly lists it — otherwise keep the flooring EXACTLY as in the original. WALLS: follow the plan when listed; when the walls are NOT in the plan, you SHOULD still repaint them in a colour taken from the style palette (see mood above) whenever the current wall colour weakens the "{{styleName}}" look — a committed wall treatment is part of the redesign. Paint only (no wallpaper, no cladding) unless the plan says otherwise.
- Any element NOT in the plan (walls excepted — see RESTYLE above): keep it EXACTLY as in the original photo (same object, same colour, same material, same place). Do not touch it.

=== NEVER DO ===
- Never repaint, recolor or reupholster an existing sofa, armchair or chair. To change a seat, swap the WHOLE piece for a new one — a single uniform fabric and colour, never two-tone.
${SHARED_RULES}
- Never change, ADD, invent, remove or RELOCATE a wall, window, door, staircase, fireplace, radiator or any structural/architectural feature — reproduce EXACTLY those present in the original photo (same number, same positions, on the SAME walls; e.g. never move the staircase, never add a window). You MAY sensibly complete furniture and decor where the room is out of frame or unclear, but the FIXED architecture stays as in the original. The original room contains EXACTLY these fixed features: {{fixedFeatures}}. Reproduce this exact set (same count, same walls) — add none, remove none. Keep room proportions, and LOCK the perspective to the original photo: same viewpoint, same camera position, height and focal length, same vanishing lines — the walls and floor must recede at the EXACT same angles. Do not pan, tilt, rotate, zoom or re-frame the room. Never alter what is visible through a window or glass door. NEVER fill in, cover, build furniture into, shrink, move or remove a door, glazed door (porte-fenêtre) or wall opening / passage to another room — keep every opening EXACTLY as in the original and KEEP IT CLEAR: never place furniture across, in front of, or blocking a door, glazed door or wall opening (they are circulation). You MAY place furniture in front of or under a WINDOW (that is realistic and allowed). If a required piece such as a dressing or wardrobe has no free SOLID wall, make it smaller or omit it — never sacrifice an opening to fit it.

=== CURRENT ROOM (reference only — what exists and where) ===
{{visionJson}}

=== SPACING & CIRCULATION ===
- Leave realistic walking space between every piece of furniture and between zones — people must be able to move around. No piece overlaps another or blocks a door, a window or a walkway.
- If the original arrangement is cramped or unrealistic (furniture too close, no circulation), you MAY move MOVABLE furniture apart to restore believable spacing — keep each piece and the fixed shell (walls/windows/doors/camera).

=== ROOM CONTENT (specific to this room type) ===
{{furnitureDefaults}}
Add only what is genuinely missing for this room, where there is real space, in the {{styleName}} style — without duplicating what is already present.
Detected elements that do NOT belong in this room and must be REMOVED (reproduce none, free their spot for appropriate furniture): {{removeList}}.

USER INSTRUCTIONS (hard — override everything above): {{userInstructions}}

Output a single photorealistic interior photograph, same viewpoint and framing as the original, natural daylight. Before finishing, re-check the plan: every REPLACE must be a genuinely different object than in the original — never the same one recolored.`;

// ─── 3 dispositions (surcouche layout au-dessus des mêmes règles) ────────────
const GEN_WOW_3_DISPOSITIONS = `You are a professional interior designer. Redesign the attached room photo into a photorealistic {{roomType}} in the "{{styleName}}" style (mood: {{styleMood}}).

=== TARGET LAYOUT for this render ===
{{dispositionBrief}}
Rearranging the MOVABLE furniture to achieve this specific layout is the goal of this render. Keep everything to real-world scale with REALISTIC walking space between pieces and between zones. Nothing overlaps or blocks doors, windows or walkways.

THE SHELL IS FIXED — never change: walls, windows, doors and their positions and sizes, room proportions, ceiling, camera angle and framing. The PERSPECTIVE is LOCKED to the original photo: same viewpoint, same camera position, height and focal length, same vanishing lines — the walls and floor must recede at the EXACT same angles. Do not pan, tilt, rotate, zoom or re-frame the room. Reproduce EXACTLY the windows, doors and FIXED architectural features (staircase, fireplace, radiator, beams, columns, built-ins) present in the original photo — same number, same positions, on the SAME walls. NEVER add, invent, remove or RELOCATE any of them (e.g. do not move the staircase to another wall, do not add a third window). It is a small room seen from a limited angle: you MAY sensibly complete furniture and decor in the parts that are out of frame or unclear, but the FIXED architecture stays exactly as in the original. The original room contains EXACTLY these fixed features: {{fixedFeatures}}. Reproduce this exact set (same count, same walls) — add none, remove none. Never alter what is visible through a window or glass door. NEVER fill in, cover, build furniture into, shrink, move or remove a door, glazed door (porte-fenêtre) or wall opening / passage to another room — keep every opening EXACTLY as in the original and KEEP IT CLEAR: never place furniture across, in front of, or blocking a door, glazed door or wall opening (they are circulation). You MAY place furniture in front of or under a WINDOW (that is realistic and allowed). If a required piece such as a dressing or wardrobe has no free SOLID wall, make it smaller or omit it — never sacrifice an opening to fit it.

STYLE DECISIONS (apply regardless of the layout):
{{designPlan}}
- REPLACE <item>: swap it for a clearly different, {{styleName}}-style piece — never recolor or reupholster a seat (replace the whole piece).
- Any element not listed: keep the SAME piece, just place it according to the target layout. Keep the existing FLOOR exactly as in the original unless the plan explicitly changes it. WALLS: follow the plan when listed; otherwise you SHOULD repaint them in a colour taken from the style palette (see mood above) whenever the current wall colour weakens the "{{styleName}}" look — a committed wall treatment is part of the redesign. Paint only (no wallpaper, no cladding).
${SHARED_RULES}

CURRENT ROOM (reference — what exists and where): {{visionJson}}
ROOM CONTENT (specific to this room type):
{{furnitureDefaults}}
Detected elements that do NOT belong in this room and must be REMOVED (reproduce none): {{removeList}}.
USER INSTRUCTIONS (hard — override everything above): {{userInstructions}}

Output ONE photorealistic interior photograph, same camera viewpoint and framing as the original, natural daylight.`;

const PROMPTS = [
  { slug: "gen_wow_generic", template: GEN_WOW_GENERIC },
  { slug: "gen_wow_3_dispositions", template: GEN_WOW_3_DISPOSITIONS },
];

async function main() {
  for (const { slug, template } of PROMPTS) {
    const { error, count } = await sb
      .from("prompts")
      .update({ template }, { count: "exact" })
      .eq("slug", slug)
      .eq("is_active", true);
    if (error) throw error;
    console.log(`✅ ${slug} mis à jour (${count} ligne(s), ${template.length} car.)`);
  }
}
main().catch((e) => { console.error("FATAL", e.message ?? e); process.exit(1); });
