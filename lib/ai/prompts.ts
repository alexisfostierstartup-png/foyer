// Prompt templates for the Foyer AI pipeline.
// Filled in alongside the Gemini / Nano Banana wrappers in a later phase.

export const DETECT_FURNITURE_PROMPT = `TODO: instruct Gemini Vision to return
the room architecture (floor, walls, ceiling, windows, lighting) and a list of
detected furniture with bounding boxes.`;

export const GENERATE_RENDER_PROMPT = `TODO: instruct the image model to restyle
the room while preserving its architecture and the furniture marked "keep".`;
