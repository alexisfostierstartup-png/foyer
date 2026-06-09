import type { DbPrompt } from "@/lib/db/database.types";

export type ResolveContext = {
  // Génération
  styleName?: string;
  styleMood?: string;
  roomType?: string;
  furnitureDefaults?: string;
  visionJson?: string; // déjà stringifié
  userInstructions?: string; // déjà formaté via formatUserInstructions
  // Itération
  userRequest?: string;
  // Clés libres
  [key: string]: unknown;
};

export type ResolvedPrompt = {
  prompt: DbPrompt;
  resolvedTemplate: string;
  missingVariables: string[];
  usedVariables: string[];
};
