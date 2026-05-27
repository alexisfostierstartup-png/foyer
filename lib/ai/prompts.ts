import type { Style, DetectedFurniture } from "@/lib/types";

export type ArchitectureContext = {
  floor: string;
  walls: string;
  ceiling: string;
  windows: string;
  lighting: string;
};

/**
 * Prompt pour la détection mobilier + analyse architecture.
 * Utilisé avec Gemini 2.5 Flash en mode JSON.
 * Les `type` correspondent aux clés de data/co2-factors.json.
 */
export const ARCHITECTURE_DETECTION_PROMPT = `
Analyze this interior room photo and return ONLY a valid JSON object with this exact structure:

{
  "architecture": {
    "floor": "description of floor material and condition (e.g., 'oak parquet, herringbone pattern')",
    "walls": "description of walls (color, material, condition)",
    "ceiling": "description of ceiling (height impression, color, features)",
    "windows": "description of windows (size, position, light direction)",
    "lighting": "current lighting in the photo (natural/artificial, intensity)"
  },
  "furniture": [
    {
      "type": "one of: canape, fauteuil, table-basse, table-a-manger, chaise, lit, matelas, armoire, commode, etagere, bureau, buffet, tapis, luminaire, decoration, autre",
      "description": "detailed visual description (color, material, style, condition)",
      "bbox": {
        "x": 0.0,
        "y": 0.0,
        "w": 0.0,
        "h": 0.0
      }
    }
  ],
  "roomStyle": "description of the existing style of the room",
  "qualityWarnings": ["any photo quality issues, e.g., 'too dark', 'blurry', 'cropped'"]
}

IMPORTANT:
- bbox coordinates are NORMALIZED 0-1 relative to image dimensions
- include EVERY visible furniture piece, even small accessories
- be precise in descriptions (avoid "a sofa", prefer "a 3-seater grey linen sofa with rolled arms")
- return ONLY the JSON, no markdown, no commentary
`.trim();

/**
 * Prompt principal pour génération WOW avec architecture-lock.
 * Utilisé avec Nano Banana (Gemini 2.5 Flash Image).
 */
export function buildWowPrompt(params: {
  architecture: ArchitectureContext;
  furnitureToKeep: DetectedFurniture[];
  furnitureToCustomize: DetectedFurniture[];
  furnitureToReplace: DetectedFurniture[];
  style: Style;
  roomType: "salon" | "chambre";
}): string {
  const {
    architecture,
    furnitureToKeep,
    furnitureToCustomize,
    furnitureToReplace,
    style,
    roomType,
  } = params;

  return `
ARCHITECTURE TO PRESERVE EXACTLY (do not modify):
- Room layout, wall positions, window placement, door placement
- Floor: ${architecture.floor}
- Walls structure: ${architecture.walls}
- Ceiling: ${architecture.ceiling}
- Windows: ${architecture.windows}
- Camera angle and perspective: identical to source image

FURNITURE TO KEEP IN PLACE EXACTLY (do not modify):
${
  furnitureToKeep.length > 0
    ? furnitureToKeep.map((f) => `- ${f.description}`).join("\n")
    : "(none)"
}

FURNITURE TO CUSTOMIZE (reshape lightly: new fabric, new paint, but same shape & position):
${
  furnitureToCustomize.length > 0
    ? furnitureToCustomize.map((f) => `- ${f.description}`).join("\n")
    : "(none)"
}

FURNITURE TO REPLACE (swap with new items matching the new style):
${
  furnitureToReplace.length > 0
    ? furnitureToReplace.map((f) => `- replace: ${f.description}`).join("\n")
    : "(none)"
}

NEW STYLE DIRECTION ("${style.name}"):
- Palette: ${style.paletteHex.join(", ")}
- Key materials: ${style.materials.join(", ")}
- Mood: ${style.mood}

ALLOWED CHANGES:
- Wall paint color (matching new palette)
- Add up to 3 small accent items (cushions, plants, small decor)
- Apply customization to marked furniture
- Replace the items marked for replacement

CONSTRAINTS:
- Photorealistic, natural daylight (not night scenes)
- Match source image's camera angle and perspective EXACTLY
- Do NOT change window position, size or views
- Do NOT move existing furniture marked as KEEP
- Do NOT add or remove walls
- Do NOT alter the floor material
- Room type: ${roomType}
  `.trim();
}

/**
 * Prompt pour audit post-génération (compare source vs rendu).
 * Utilisé avec Gemini 2.5 Flash Vision en mode JSON.
 */
export const QUALITY_AUDIT_PROMPT = `
Compare these two interior images (image 1 = source, image 2 = generated render).
Return ONLY a valid JSON object:

{
  "architecturalConsistency": 0-10,
  "furniturePreservation": 0-10,
  "perspectiveMatch": 0-10,
  "issues": ["list of specific problems if any"],
  "overallPass": true/false
}

A score of 7+ is acceptable. Below 7 = fail.
`.trim();
