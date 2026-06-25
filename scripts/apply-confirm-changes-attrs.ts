#!/usr/bin/env npx tsx
/**
 * DÉPLOIEMENT du prompt `confirm_changes` pour l'Étape 2 (attrs structurés).
 * À lancer EN MÊME TEMPS que le déploiement du code (sinon `{{attrsInstruction}}` reste
 * littéral sur l'ancien code — la DB prompts est partagée local↔prod).
 *
 * Ajoute, par chirurgie de chaîne (idempotent) : `attrs` à l'exemple results + le
 * placeholder `{{attrsInstruction}}` (peuplé en code par buildAttrsInstruction).
 *
 *   npx tsx scripts/apply-confirm-changes-attrs.ts          # applique
 *   npx tsx scripts/apply-confirm-changes-attrs.ts --revert # restaure l'original (backup)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFileSync } from "fs";

const BACKUP = "supabase/confirm_changes-original-2026-06-25.txt";

async function main() {
  const revert = process.argv.includes("--revert");
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;

  if (revert) {
    const original = readFileSync(BACKUP, "utf8");
    await sb.from("prompts").update({ template: original }).eq("slug", "confirm_changes");
    console.log("✓ confirm_changes restauré depuis le backup.");
    process.exit(0);
  }

  const { data } = await sb.from("prompts").select("template").eq("slug", "confirm_changes").single();
  let t: string = data.template;
  if (t.includes("attrsInstruction")) { console.log("déjà appliqué (idempotent), skip."); process.exit(0); }

  const before = t;
  t = t.replace(
    "\"bbox\": [0.55, 0.40, 0.20, 0.30] }",
    "\"bbox\": [0.55, 0.40, 0.20, 0.30], \"attrs\": { /* attributs V3 de la catégorie de l'élément */ } }",
  );
  t = t.replace("Judge each element INDEPENDENTLY", "{{attrsInstruction}}\n\nJudge each element INDEPENDENTLY");
  const ok = t.includes("\"attrs\": {") && t.includes("{{attrsInstruction}}") && t !== before;
  if (!ok) { console.error("✗ remplacement échoué (template inattendu) — abandon."); process.exit(1); }
  await sb.from("prompts").update({ template: t }).eq("slug", "confirm_changes");
  console.log("✓ confirm_changes mis à jour (attrs + {{attrsInstruction}}).");
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
