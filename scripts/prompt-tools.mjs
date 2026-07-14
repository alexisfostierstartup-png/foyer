#!/usr/bin/env node
/**
 * OUTILS PROMPTS — la DB est la SOURCE DE VÉRITÉ (canal dev/prod par ligne).
 *
 * Workflow :
 *  1. `node scripts/prompt-tools.mjs fork <slug>`      → copie la prod active en
 *     nouvelle version DEV (conditions.channel='dev') que tu édites en DB.
 *     Localement, PROMPTS_CHANNEL=dev la sert ; la prod ne voit rien.
 *  2. `node scripts/prompt-tools.mjs dump`             → snapshot de tous les
 *     prompts actifs dans prompts/ (à committer : historique + diff git).
 *  3. `node scripts/prompt-tools.mjs diff <slug>`      → diff dev vs prod.
 *  4. `node scripts/prompt-tools.mjs promote <slug>`   → la version DEV devient
 *     la nouvelle prod (version+1, ancienne prod désactivée, dev désactivée).
 *  5. `node scripts/prompt-tools.mjs rollback <slug>`  → réactive la version
 *     prod précédente (l'actuelle est désactivée).
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { writeFile, mkdir } from "fs/promises";

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const [cmd, slug] = process.argv.slice(2);

const channelOf = (p) => p.conditions?.channel ?? "prod";

async function rows(slugArg) {
  const q = sb.from("prompts").select("*").order("version", { ascending: false });
  const { data, error } = slugArg ? await q.eq("slug", slugArg) : await q;
  if (error) throw error;
  return data;
}

async function activeRow(slugArg, channel) {
  return (await rows(slugArg)).find((p) => p.is_active && channelOf(p) === channel);
}

if (cmd === "dump") {
  const all = (await rows()).filter((p) => p.is_active);
  await mkdir("prompts", { recursive: true });
  for (const p of all) {
    const suffix = channelOf(p) === "dev" ? ".dev" : "";
    await writeFile(`prompts/${p.slug}${suffix}.txt`, `# slug: ${p.slug} | v${p.version} | ${channelOf(p)} | ${p.updated_at}\n${p.template}`);
  }
  console.log(`✓ ${all.length} prompts actifs dumpés dans prompts/ — committez pour l'historique.`);
} else if (cmd === "fork") {
  if (!slug) { console.error("usage: fork <slug>"); process.exit(1); }
  const prod = await activeRow(slug, "prod");
  if (!prod) { console.error(`✗ pas de prod active pour ${slug}`); process.exit(1); }
  const existing = await activeRow(slug, "dev");
  if (existing) { console.error(`✗ une dev active existe déjà (v${existing.version}) — éditez-la ou promote/désactivez-la.`); process.exit(1); }
  const maxV = Math.max(...(await rows(slug)).map((p) => p.version ?? 0));
  const { error } = await sb.from("prompts").insert({
    slug, purpose: prod.purpose, provider: prod.provider, template: prod.template,
    conditions: { ...(prod.conditions ?? {}), channel: "dev" },
    is_active: true, version: maxV + 1, notes: `fork dev de v${prod.version}`,
  });
  if (error) throw error;
  console.log(`✓ ${slug} v${maxV + 1} (dev) créé depuis prod v${prod.version}. PROMPTS_CHANNEL=dev pour le servir.`);
} else if (cmd === "diff") {
  if (!slug) { console.error("usage: diff <slug>"); process.exit(1); }
  const [prod, dev] = [await activeRow(slug, "prod"), await activeRow(slug, "dev")];
  if (!prod || !dev) { console.error(`✗ il faut une prod ET une dev actives (prod: ${!!prod}, dev: ${!!dev})`); process.exit(1); }
  const [a, b] = [prod.template.split("\n"), dev.template.split("\n")];
  for (const l of a) if (!b.includes(l) && l.trim()) console.log(`- ${l.slice(0, 160)}`);
  for (const l of b) if (!a.includes(l) && l.trim()) console.log(`+ ${l.slice(0, 160)}`);
} else if (cmd === "promote") {
  if (!slug) { console.error("usage: promote <slug>"); process.exit(1); }
  const [prod, dev] = [await activeRow(slug, "prod"), await activeRow(slug, "dev")];
  if (!dev) { console.error(`✗ pas de dev active pour ${slug}`); process.exit(1); }
  const maxV = Math.max(...(await rows(slug)).map((p) => p.version ?? 0));
  if (prod) await sb.from("prompts").update({ is_active: false, notes: `${prod.notes ?? ""} [remplacée par v${maxV + 1}]`.trim() }).eq("id", prod.id);
  await sb.from("prompts").update({ is_active: false }).eq("id", dev.id);
  const { conditions, ...rest } = dev;
  const { channel: _c, ...prodConds } = conditions ?? {};
  const { error } = await sb.from("prompts").insert({
    slug, purpose: rest.purpose, provider: rest.provider, template: rest.template,
    conditions: Object.keys(prodConds).length ? prodConds : null,
    is_active: true, version: maxV + 1, notes: `promue depuis dev v${dev.version}`,
  });
  if (error) throw error;
  console.log(`✓ ${slug} v${maxV + 1} est la nouvelle PROD (ex-prod v${prod?.version ?? "—"} désactivée, dev v${dev.version} désactivée).`);
} else if (cmd === "rollback") {
  if (!slug) { console.error("usage: rollback <slug>"); process.exit(1); }
  const all = (await rows(slug)).filter((p) => channelOf(p) === "prod");
  const current = all.find((p) => p.is_active);
  const previous = all.filter((p) => !p.is_active && p.template).sort((x, y) => (y.version ?? 0) - (x.version ?? 0))[0];
  if (!current || !previous) { console.error(`✗ rien à rollback (actuelle: ${!!current}, précédente: ${!!previous})`); process.exit(1); }
  await sb.from("prompts").update({ is_active: false }).eq("id", current.id);
  await sb.from("prompts").update({ is_active: true }).eq("id", previous.id);
  console.log(`✓ ${slug} : v${previous.version} réactivée (v${current.version} désactivée).`);
} else if (cmd === "clean") {
  // Purge les vieilles versions : archive TOUT dans prompts/archive/ (git),
  // puis ne garde en DB que les lignes ACTIVES + la dernière prod inactive
  // par slug (cible du rollback). L'historique complet vit dans git.
  const all = await rows();
  await mkdir("prompts/archive", { recursive: true });
  const bySlug = new Map();
  for (const p of all) { if (!bySlug.has(p.slug)) bySlug.set(p.slug, []); bySlug.get(p.slug).push(p); }
  let archived = 0, deleted = 0;
  for (const [s, list] of bySlug) {
    for (const p of list) {
      await writeFile(`prompts/archive/${s}.v${p.version ?? 0}.${channelOf(p)}${p.is_active ? ".ACTIVE" : ""}.txt`,
        `# ${s} v${p.version} | ${channelOf(p)} | active:${p.is_active} | ${p.updated_at}\n# notes: ${p.notes ?? ""}\n${p.template}`);
      archived++;
    }
    const keep = new Set(list.filter((p) => p.is_active).map((p) => p.id));
    const lastInactiveProd = list.filter((p) => !p.is_active && channelOf(p) === "prod").sort((a, b) => (b.version ?? 0) - (a.version ?? 0))[0];
    if (lastInactiveProd) keep.add(lastInactiveProd.id);
    const toDelete = list.filter((p) => !keep.has(p.id));
    for (const p of toDelete) { await sb.from("prompts").delete().eq("id", p.id); deleted++; }
    if (toDelete.length) console.log(`  ${s}: ${toDelete.length} version(s) purgée(s), gardé actives + v${lastInactiveProd?.version ?? "—"} (rollback)`);
  }
  console.log(`✓ ${archived} versions archivées dans prompts/archive/ (committez), ${deleted} lignes purgées de la DB.`);
} else {
  console.log("usage: node scripts/prompt-tools.mjs <dump|fork|diff|promote|rollback|clean> [slug]");
}
