#!/usr/bin/env npx tsx
/**
 * Seed des prompts du flux EXPERT en DB (expert_swap / expert_iterate / render_hd).
 *
 * Historiquement codés en dur dans lib/ai/expert.ts → invisibles dans l'admin
 * (constat Alexis 2026-07-16). La source des textes = lib/prompts/expertTemplates.ts
 * (constantes de repli du code). IDEMPOTENT et NON-DESTRUCTIF : un slug qui a déjà
 * une ligne ACTIVE n'est jamais touché — l'admin reste la source de vérité après
 * le premier seed (re-seeder n'écrase aucune édition).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();

async function main() {
  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { EXPERT_SWAP_TEMPLATE, EXPERT_ITERATE_TEMPLATE, RENDER_HD_TEMPLATE } = await import("../lib/prompts/expertTemplates");
  const sb = createSupabaseAdmin();

  const seeds = [
    { slug: "expert_swap", purpose: "generation", provider: "nano_banana", template: EXPERT_SWAP_TEMPLATE,
      notes: "Swap expert NB2 : incruster les produits catalogue dans le rendu ({{room}}, {{mapping}}). Migré du code 2026-07-16." },
    { slug: "expert_iterate", purpose: "generation", provider: "nano_banana", template: EXPERT_ITERATE_TEMPLATE,
      notes: "Itération expert (sol/peinture/objet ciblé) : {{userRequest}}, {{cible}}. Migré du code 2026-07-16." },
    { slug: "render_hd", purpose: "generation", provider: "nano_banana", template: RENDER_HD_TEMPLATE,
      notes: "Tirage HD 4K : détail/netteté uniquement, contenu figé. Migré du code 2026-07-16." },
  ];

  for (const s of seeds) {
    const { data: existing } = await sb.from("prompts").select("id, version").eq("slug", s.slug).eq("is_active", true).maybeSingle();
    if (existing) {
      console.log(`↷ ${s.slug} : ligne active v${existing.version} déjà en DB — non touché`);
      continue;
    }
    const { error } = await sb.from("prompts").insert({ ...s, conditions: {}, is_active: true, version: 1 });
    if (error) throw new Error(`${s.slug}: ${error.message}`);
    console.log(`✓ ${s.slug} v1 seedé`);
  }
}

main().catch((e) => { console.error("erreur:", e); process.exit(1); });
