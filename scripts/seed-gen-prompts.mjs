// Source de vérité des PROMPTS DE GÉNÉRATION (table `prompts`, sinon éditée via
// /admin/prompts). REFONTE 2026-07-09 (post-démo) : l'ambition ESTHÉTIQUE passe en
// tête (le rendu doit donner envie — le référent beauté par style arrive via
// {{styleMood}}, cf. seed-style-beauty.mjs), les règles dures sont COMPACTÉES
// (l'ancien mur de 10k chars diluait tout : papier peint chintz malgré la règle),
// et le bloc anti-hallucination est unifié (miroirs, doublons, pièces adjacentes).
// Chaque leçon de bench/bug reste encodée — juste plus courte.
// Les règles communes vivent UNE fois dans SHARED_RULES ; les variantes DIY beta
// sont DÉRIVÉES des templates de base (mustReplace) → zéro drift possible.
//
// Usage: node scripts/seed-gen-prompts.mjs
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

// ─── Ambition esthétique (générique — le par-style vient de styleMood) ───────
const AESTHETIC_BAR = `=== MAKE IT BEAUTIFUL — this matters as much as any rule below ===
The result must be a light-filled, editorial-quality interior photograph the owner instantly wants to live in — shot for a design magazine, not generated.
- LIGHT & ATMOSPHERE: never flat, grey or clinical midday light — light the scene to the style's own light signature (the "craft" line of STYLE DNA: e.g. golden-hour warmth, soft diffused sun). The room's own lamps are ON, casting a warm believable glow layered into the daylight. Correct the source photo's exposure flaws (blown-out windows, glare, dimness): the output is always a well-exposed photograph — without adding, moving or removing any fixed light point.
- COMMITMENT: execute the style at FULL conviction — the transformation must be unmistakable at first glance: walls, seats, rug, textiles, decor and light mood ALL speak the style together. A timid render (a few swapped cushions on an otherwise unchanged room) is a FAILURE. This never overrides a KEEP: kept pieces stay untouched — commitment comes from everything AROUND them.
- WALLS CARRY THE STYLE: unless the plan locks them, repaint the FULL wall envelope in the style's palette — including wainscot, boiserie and mouldings in a coordinated tone (paint on wall trim is expected and welcome). Leaving builder-white/pale walls when the style's palette is coloured is a FAILURE of commitment: a bold, saturated wall colour from the palette transforms the room more than any furniture swap.
- COLOUR DISCIPLINE: one cohesive story built from the style palette — 3-4 tones repeated across furniture, textiles and decor. No random colour that belongs to no story.
- ROOM-AWARE CASTING: from the style's palette, choose the colour story that FLATTERS what this room keeps — its floor, fireplace, mouldings, kept furniture. A warm red-brown floor calls for warm/earthy wall tones from the palette, not a cold clashing hue; the result must look designed FOR this room, not pasted onto it. Applied wall colours cover their surface COMPLETELY and uniformly (every moulding section, no half-painted walls).
- REAL MATERIALS: visible wood grain, fabric weave, stone veining; matte and tactile beats glossy and plastic-looking.
- STYLING — the room must feel INHABITED, never staged-empty: every prominent surface (mantel, dresser top, coffee table, shelf) carries a styled vignette (books, ceramics, candles, greenery); textiles are layered and draped (a throw over a sofa arm, mixed cushions); plants live at several heights where the style calls for them. Abundance stays bounded by the style's own NEVER list — generous and collected, never junky.
- AMBIANCE DECOR: dress the room like a lived-in editorial shoot. NEVER invent a window, door or opening to hang decor on: curtains exist ONLY on windows/french doors the original photo already shows — a room with no visible window gets NO curtains. The style's decorative lighting (string lights, candles, lanterns) is present and LIT with a warm glow — it is DECOR, not an electrical fixture: it never counts as, replaces or relocates a fixed light point.
- WALL ART: hung as a considered composition — one large statement piece or a small aligned gallery; never a single small lone frame lost on a big wall. If an EXISTING artwork must stay, integrate it: complete the wall around it with style-matching pieces so it belongs to the composition — a lone mismatched frame reads as a mistake. Non-shoppable wall decor still shapes the render: dress the walls for the style.
- PAINT GESTURES: bold paint moves that fit the style are WELCOME (half-height horizontal band, painted arch, colour block) — and when you make one, compose the furniture with it (e.g. centre a low piece under an arch, align the gesture with what stands against that wall).
- RUG ANCHOR: the seating zone sits on ONE large style-matching rug that visually ties sofa, armchairs and coffee table together (generous size — furniture front legs ON the rug; skip only if the plan keeps/showcases the bare floor explicitly).
- FULLNESS: the room is furnished to its potential — visibly empty stretches of floor or bare walls (when space clearly allows) get a style-matching piece, plant, rug or artwork; complete and lived-in, yet never overfilled: circulation stays free and every rule below still wins.
- GROUNDING: every object sits with natural contact shadows, correct scale and perspective.`;

// ─── Règles communes (anti-hallucination + sécurité) — UNE seule définition ──
const SHARED_RULES = `- SEATS: never repaint, recolor or reupholster an existing sofa, armchair or chair — to change a seat, swap the WHOLE piece for a genuinely different model (single uniform fabric, never two-tone).
- LIGHTING: the room has a FIXED set of electrical light points — swap each existing fixture for a {{styleName}} one at the EXACT same point (expected and good), but NEVER add, duplicate or relocate a ceiling or wall light. If more light is truly needed AND the room has no floor/table lamp, you MAY add ONE movable lamp on clear floor — never beside an existing lamp, never overlapping furniture.
- FIXED EQUIPMENT: radiators, water heaters and staircases stay EXACTLY as in the original — same object, same wall, never repainted, replaced, covered or merged into furniture; the wall area they occupy stays clear.
- SOLID WORLD: objects never intersect, float or clip into each other; each freestanding piece stands fully on the floor.
- MIRRORS & REFLECTIONS: every mirror shows a plausible reflection of THIS room only — never an object that does not exist in the room, never a duplicated fixture. Never add objects that exist only in a reflection.
- NO DUPLICATES: never render two near-identical statement pieces (two of the same pendant, two of the same lamp) unless the original room has them.
- SURFACES: style materials apply to FURNITURE and DECOR only. Walls stay smooth painted plaster — colour may change, material never (no brick, concrete, rough/adobe plaster, stone, cladding, tiles, and NO WALLPAPER — paint only). The ceiling keeps its exact original structure, material and colour. The floor changes only when the plan explicitly says so.
- STYLE vs ARCHITECTURE: a signature element that is architectural (mouldings, cornice, fireplace, beams, arches, brick, panelling, extra windows) appears ONLY if the original photo already has it — otherwise express the style through furniture, textiles, paint and decor. A rectangular doorway NEVER becomes an arch; a plain ceiling stays plain.
- LAYOUT & SEATING GROUP: seats form a coherent conversation group — oriented toward each other and the room's focal point (fireplace, TV or coffee table), never a seat turned away from its group. Replacement seating offers a comparable seating capacity to the original — judge by visible size, don't drastically shrink a large sofa into a tiny one (nor force an oversized one into a small room). Any piece you ADD belongs to its coherent zone (a pouf or side table lives beside the seating area, never floating next to a dining table). Every function the original room shows (dining corner, desk, reading spot) still exists in the result — restyled, never removed.
- FIREPLACE: NEVER add a fireplace to a room whose photo shows none — no exception, whatever the style. ONLY when the photo already shows a fireplace: treat it as the natural focal point — orient the main seating toward it when the layout allows, keep it visible and staged (never hidden behind furniture), and never place a sofa or any furniture directly against or in front of the firebox.
- TECH: any TV or screen is a MODERN flat-screen (never CRT/vintage) — the style governs decor, not the era of electronics.
- TEXT: add no text, logo or lettering of your own anywhere.`;

// ─── Verrou architecture (compact — chaque phrase = un bug réel corrigé) ─────
const SHELL_LOCK = `=== THE SHELL IS LOCKED ===
Reproduce EXACTLY the room's architecture: same walls, windows, doors, openings, staircase, fireplace — same count, same positions, same walls. The original contains EXACTLY: {{fixedFeatures}} — add none, remove none, move none. THE PHOTO IS THE TRUTH: if you can see an opening, door, glazed door or window in the photo that this count missed, PRESERVE it anyway — never wall up, fill or cover ANY opening visible in the photo, listed or not. A solid wall stays solid (never becomes a window); a plain flat ceiling stays plain (no beams, coffers, slats); no new column, arch, niche, mantel, fireplace, chimney breast or built-in — even if the style is famous for them. EXCEPTION — flat WALL FINISHES only: painted wall mouldings/panelling and wallpaper are allowed when the style or plan calls for them (they dress the wall surface without altering any opening, volume or the ceiling). When the plan gives a wall an EXPLICIT action (e.g. repaint in a stated colour), the plan WINS — apply exactly that action, not the style's signature wall finish. Openings and doorways stay CLEAR walk-throughs — never filled, covered, blocked or furnished inside; keep circulation free in front of every door and opening (low furniture in front of a WINDOW is fine, but never a TV or tall unit hiding the glazing, and nothing covering a radiator). Keep the exact footprint, wall positions, ceiling height, recesses and volumes — do not enlarge or reshape the space. Rooms visible THROUGH doors and openings stay EXACTLY as in the original — never furnish, restyle or light them, and NEVER add stairs, radiators, doors or fixtures inside them. A radiator exists ONLY where the photo shows one — never add or duplicate a radiator anywhere. PERSPECTIVE LOCKED: same viewpoint, camera height, focal length and vanishing lines — do not pan, tilt, zoom or reframe. Never alter what is visible through a window. Electrical outlets and switches stay exactly where the photo shows them — never moved, added or removed; a plug-in floor/table lamp sits NEAR an existing outlet (or shows no cord), never plugged into an invented one. If a required piece has no free solid wall, make it smaller or omit it — never sacrifice an opening.`;

// ─── Rendu unique (piloté par le plan) ───────────────────────────────────────
const GEN_WOW_GENERIC = `You are an award-winning interior designer and photo stylist. Redesign the attached room photo into the SAME room, transformed into a photorealistic {{roomType}} in the "{{styleName}}" style.
STYLE DNA: {{styleMood}}

${AESTHETIC_BAR}

=== WHAT TO CHANGE — follow this plan literally ===
{{designPlan}}

How to apply the plan:
- REPLACE <item>: the original must be GONE — a clearly different {{styleName}} piece in the same spot (same footprint and position, unless the plan line itself prescribes a different geometry, which wins). Merely recoloring or re-covering it is a FAILURE.
- If the plan says "None — restyle freely": you may change any piece, but every piece you change follows the REPLACE rule — and for SEATS especially, never re-colour or re-texture the existing silhouette: swap the whole seat for a different model, or keep it exactly.
- RESTYLE <item>: valid ONLY for walls (repaint) and floor (refinish) — furniture listed as RESTYLE must be REPLACED instead. FLOOR: only when the plan lists it, otherwise keep it EXACTLY. WALLS: follow the plan; when walls are not in the plan you SHOULD still repaint them in a palette colour whenever the current colour weakens the style — a committed wall treatment is part of the redesign. Paint only.
- Anything NOT in the plan (walls excepted): keep it EXACTLY as in the original — same object, colour, material, place.

=== HARD RULES ===
${SHARED_RULES}

${SHELL_LOCK}

=== CURRENT ROOM (reference only — what exists and where) ===
{{visionJson}}

=== SPACING ===
Realistic walking space between pieces and zones; nothing overlaps or blocks circulation. If the original arrangement is cramped, you MAY spread MOVABLE furniture apart (keep every piece and the locked shell).

=== ROOM CONTENT ===
{{furnitureDefaults}}
Add only what is genuinely missing, where there is real space, in the {{styleName}} style — never duplicating what is already present.
Detected elements that do NOT belong in this room — REMOVE them (reproduce none, free their spot): {{removeList}}.

USER INSTRUCTIONS (hard — override everything above): {{userInstructions}}

Output a single photorealistic interior photograph, same viewpoint and framing as the original, lit to the style's mood (warm and believable, lamps glowing). Final check before output: (1) every REPLACE is a genuinely different object — never the original re-coloured; (2) the shell matches the original (same windows/doors/openings count and positions; staircase, radiators and water heater present AT THEIR ORIGINAL WALL AND POSITION — a radiator is plumbed in, it can NEVER move to make room for furniture: the furniture adapts around it); (3) mirrors reflect this room only; (4) the image looks like a beautiful magazine photograph of THIS room.`;

// ─── 3 dispositions (surcouche layout au-dessus des mêmes règles) ────────────
const GEN_WOW_3_DISPOSITIONS = `You are an award-winning interior designer and photo stylist. Redesign the attached room photo into the SAME room, transformed into a photorealistic {{roomType}} in the "{{styleName}}" style.
STYLE DNA: {{styleMood}}

${AESTHETIC_BAR}

=== TARGET LAYOUT for this render ===
{{dispositionBrief}}
Rearranging the MOVABLE furniture into this layout is the goal of this render. The furniture MUST be what genuinely belongs in a {{roomType}}: a bedroom is built around the BED (nightstands, dresser, wardrobe) — never living-room seating in a bedroom, never a bed in a living room. Use the ROOM CONTENT list to decide WHICH pieces belong. Real-world scale, realistic walking space, nothing overlapping or blocking doors, windows or walkways.

STYLE DECISIONS (apply regardless of the layout):
{{designPlan}}
- REPLACE <item>: swap it for a clearly different {{styleName}} piece — never recolor or reupholster a seat (replace the whole piece).
- Any element not listed: keep the SAME piece, placed per the target layout. FLOOR: keep it EXACTLY unless the plan changes it. WALLS: follow the plan; otherwise you SHOULD repaint them in a palette colour whenever the current colour weakens the style. Paint only.

=== HARD RULES ===
${SHARED_RULES}

${SHELL_LOCK}

CURRENT ROOM (reference — what exists and where): {{visionJson}}
ROOM CONTENT: {{furnitureDefaults}}
Detected elements that do NOT belong in this room — REMOVE them (reproduce none): {{removeList}}.
USER INSTRUCTIONS (hard — override everything above): {{userInstructions}}

Output ONE photorealistic interior photograph, same camera viewpoint and framing as the original, lit to the style's mood (warm and believable, lamps glowing). Final check: shell identical to the original, mirrors reflect this room only, and the image looks like a beautiful magazine photograph of THIS room.`;

// ─── Variantes DIY beta — DÉRIVÉES des templates de base (une seule source) ──
// Le mode DIY beta autorise RESTYLE sur un MEUBLE (customisation en place :
// peinture, teinte, retapissage…) là où le flux normal l'interdit.
function mustReplace(template, find, replacement, label) {
  if (!template.includes(find)) throw new Error(`Fragment introuvable pour la variante DIY: ${label}`);
  return template.replace(find, replacement);
}

const GEN_WOW_GENERIC_DIY_BETA = [
  [
    "- RESTYLE <item>: valid ONLY for walls (repaint) and floor (refinish) — furniture listed as RESTYLE must be REPLACED instead. FLOOR:",
    "- RESTYLE <item>: apply the described customization to the EXACT same piece — keep its shape, size, structure and position; change ONLY the described finish (paint colour, wood stain, oil, new upholstery fabric). The result stays recognizably the SAME object with ONE uniform new finish — never two-tone, never a different model. Apply each RESTYLE strictly to its own piece — never spill its colour onto neighbours, never tint the whole scene. FLOOR:",
    "howto RESTYLE",
  ],
  [
    "- SEATS: never repaint, recolor or reupholster an existing sofa, armchair or chair — to change a seat, swap the WHOLE piece for a genuinely different model (single uniform fabric, never two-tone).",
    "- SEATS: never repaint, recolor or reupholster an existing sofa, armchair or chair UNLESS the plan explicitly lists it as RESTYLE (then apply exactly that change as ONE uniform finish). A seat listed as REPLACE must become a visibly DIFFERENT model — recoloring it is a FAILURE.",
    "règle sièges",
  ],
  [
    "(3) mirrors reflect this room only;",
    "(3) mirrors reflect this room only; each RESTYLE line's finish is VISIBLY applied on the SAME object and no global colour wash was applied;",
    "re-check DIY",
  ],
].reduce((t, [find, repl, label]) => mustReplace(t, find, repl, label), GEN_WOW_GENERIC);

const GEN_WOW_3_DISPOSITIONS_DIY_BETA = [
  [
    "- REPLACE <item>: swap it for a clearly different {{styleName}} piece — never recolor or reupholster a seat (replace the whole piece).",
    "- REPLACE <item>: swap it for a clearly different {{styleName}} piece — never recolor a seat listed as REPLACE.\n- RESTYLE <item>: keep the EXACT same piece (shape, size, structure), place it per the target layout, change ONLY the described finish — ONE uniform finish, never two-tone, never a different model, never spilling onto neighbours.",
    "style decisions DIY",
  ],
].reduce((t, [find, repl, label]) => mustReplace(t, find, repl, label), GEN_WOW_3_DISPOSITIONS);

const PROMPTS = [
  { slug: "gen_wow_generic", template: GEN_WOW_GENERIC },
  { slug: "gen_wow_3_dispositions", template: GEN_WOW_3_DISPOSITIONS },
  { slug: "gen_wow_generic_diy_beta", template: GEN_WOW_GENERIC_DIY_BETA },
  { slug: "gen_wow_3_dispositions_diy_beta", template: GEN_WOW_3_DISPOSITIONS_DIY_BETA },
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
