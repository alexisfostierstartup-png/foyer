#!/usr/bin/env npx tsx
/**
 * BACKFILL STYLE TAGS — remplit partner_products.style_affinity (text[], multi-tag)
 * avec les slugs des 18 collections canoniques (data/styles.json), via Gemini
 * flash-lite sur nom + description + image produit.
 *
 * Multi-tag SÉLECTIF : 0 à 4 styles où le produit est un fit CONVAINCANT tel quel.
 * Un produit neutre/générique peut rester à [] (le scoring n'applique qu'un BONUS,
 * jamais de pénalité). Idempotent : ne touche que style_affinity NULL ou vide,
 * sauf --force. Batché + throttlé + reprise, coût tracké dans ai_calls.
 *
 * Usage :
 *   npx tsx scripts/backfill-style-tags.ts --limit=10          # échantillon de validation
 *   npx tsx scripts/backfill-style-tags.ts --cat=sofa          # une catégorie
 *   npx tsx scripts/backfill-style-tags.ts --all               # tout le catalogue vide
 *   npx tsx scripts/backfill-style-tags.ts --ids=a,b --force   # re-tag ciblé
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFile } from "fs/promises";
import path from "path";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
const MODEL = process.argv.includes("--flash") ? "gemini-2.5-flash" : "gemini-2.5-flash-lite";
const CONCURRENCY = 12;

function arg(name: string): string | undefined {
  return process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function main() {
  const limit = Number(arg("limit") ?? 0);
  const cat = arg("cat");
  const ids = arg("ids")?.split(",");
  const all = process.argv.includes("--all");
  const force = process.argv.includes("--force");
  if (!limit && !cat && !ids && !all) {
    console.error("Usage: backfill-style-tags --limit=N | --cat=<slug> | --all | --ids=a,b [--force] [--flash]");
    process.exit(1);
  }

  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { getVisionProvider } = await import("../lib/ai/provider");
  const { withTracking } = await import("../lib/ai/track");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;

  // 18 slugs canoniques + descripteur court (mood tronqué) pour ancrer le jugement.
  const stylesJson = JSON.parse(await readFile(path.join(process.cwd(), "data/styles.json"), "utf8"));
  const styleList: { slug: string; brief: string }[] = (Array.isArray(stylesJson) ? stylesJson : stylesJson.styles).map(
    (s: { slug: string; data: { mood?: string; name?: string } }) => ({
      slug: s.slug,
      brief: (s.data?.mood ?? s.data?.name ?? s.slug).split(",").slice(0, 3).join(","),
    }),
  );
  const validSlugs = new Set(styleList.map((s) => s.slug));

  const prompt = `Tu es styliste déco exigeant. Voici nos 18 collections de styles (slug: définition) :
${styleList.map((s) => `- ${s.slug}: ${s.brief}`).join("\n")}

PRODUIT (photo jointe) :
{{product}}

Classe ce produit sur DEUX niveaux (slugs de la liste uniquement, pas de limite de nombre mais sois honnête) :
- "core" : les styles que ce produit INCARNE — il pourrait figurer sur le moodboard de référence du style, un décorateur le choisirait comme pièce représentative. Exigence haute : la matière, la forme ou la couleur portent clairement l'identité du style.
- "compatible" : les styles où il s'intègre sans détonner, sans en être une pièce signature.

Règles :
- Un produit GÉNÉRIQUE sans parti pris esthétique (caisson, armoire ou étagère blanc/uni basique type IKEA BESTA/SKRUVBY/KALLAX, meuble purement fonctionnel) : core = [] SANS EXCEPTION — la sobriété n'est pas une identité de style. Au mieux compatible = 2-4 styles sobres.
- Un produit au style marqué (velours côtelé orange, rotin sculptural, laiton Art déco) : 1 à 3 core précis.
- compatible = 6 styles MAXIMUM, les plus naturels. « Compatible avec presque tout » = ne rien lister au-delà des 6 plus évidents.
- La marque est un indice (ex. design scandinave chez un fabricant scandinave) mais l'APPARENCE prime toujours.
- Ne mets JAMAIS un style en core "parce qu'il pourrait aller" — c'est la définition de compatible.
Réponds en JSON STRICT : {"core": ["slug"], "compatible": ["slug"]}`;

  // Catégories exclues : matchers dédiés (peinture = ΔE couleur, sol = filtre matériau)
  // où un tag de style n'apporte rien et bruite le dashboard.
  const EXCLUDED_CATEGORIES = ["paint", "floor"];

  // Sélection des produits à tagger.
  let query = sb.from("partner_products").select("id, name, description, category, merchant, primary_image_url").not("primary_image_url", "is", null)
    .not("category", "in", `(${EXCLUDED_CATEGORIES.join(",")})`);
  // La colonne est initialisée à {} pour tout le catalogue → impossible de distinguer
  // « jamais traité » de « traité, aucun core » par la seule colonne. Le marqueur de
  // traitement est metadata.style_tagged_at (posé à chaque écriture) : on ne re-traite
  // que les produits SANS marqueur (sinon la boucle --all re-paie les génériques).
  if (!force) query = query.is("metadata->style_tagged_at", null);
  if (cat) query = query.eq("category", cat);
  if (ids) query = query.in("id", ids);
  // Supabase plafonne à 1000 lignes par SELECT. En mode --all on boucle : les produits
  // taggés sortent du filtre "vide" → re-quérir jusqu'à épuisement est idempotent.
  query = query.limit(limit ? limit * 3 : 1000);
  const { data: rows, error } = await query;
  if (error) throw error;
  // Échantillon varié pour la validation : shuffle avant coupe.
  const products = (limit ? rows.sort(() => Math.random() - 0.5).slice(0, limit) : rows) as {
    id: string; name: string; description: string | null; category: string; merchant: string; primary_image_url: string;
  }[];
  console.log(`${products.length} produit(s) à tagger (modèle ${MODEL})`);

  let done = 0, failed = 0, next = 0;
  const results: { name: string; category: string; merchant: string; tags: string[]; compat?: string[] }[] = [];
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, products.length) }, async () => {
      while (next < products.length) {
        const p = products[next++];
        try {
          const imgRes = await fetch(p.primary_image_url, { headers: { "User-Agent": UA, Accept: "image/jpeg,image/webp,image/png" } });
          if (!imgRes.ok) throw new Error(`image HTTP ${imgRes.status}`);
          const buf = Buffer.from(await imgRes.arrayBuffer());
          const productDesc = `nom: ${p.name}\ncatégorie: ${p.category}\ndescription: ${(p.description ?? "").slice(0, 300)}`;
          const res = await withTracking(
            { step: "other", provider: "gemini_vision", requestPayload: { model: MODEL, purpose: "style_tags" } },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            () => getVisionProvider("gemini_vision").analyze(prompt.replace("{{product}}", productDesc), [buf as any], { model: MODEL }),
          );
          let parsed = res.parsed as { core?: string[]; compatible?: string[] } | null;
          if (!parsed || (!Array.isArray(parsed.core) && !Array.isArray(parsed.compatible))) {
            const m = res.text.match(/\{[\s\S]*\}/);
            parsed = m ? JSON.parse(m[0]) : { core: [], compatible: [] };
          }
          const core = [...new Set((parsed?.core ?? []).filter((s) => validSlugs.has(s)))];
          // compatible plafonné à 6 : au-delà, la liste ne discrimine plus rien.
          const compatible = [...new Set((parsed?.compatible ?? []).filter((s) => validSlugs.has(s) && !core.includes(s)))].slice(0, 6);
          // core → style_affinity (dashboard + bonus fort) ; compatible → metadata
          // (bonus faible éventuel), fusion non destructive du metadata existant.
          const { data: cur } = await sb.from("partner_products").select("metadata").eq("id", p.id).single();
          const { error: upErr } = await sb.from("partner_products").update({
            style_affinity: core,
            metadata: { ...(cur?.metadata ?? {}), style_compatible: compatible, style_tagged_at: new Date().toISOString() },
          }).eq("id", p.id);
          if (upErr) throw upErr;
          results.push({ name: p.name.slice(0, 60), category: p.category, merchant: p.merchant, tags: core, compat: compatible });
          done++;
          if (done % 100 === 0) console.log(`… ${done}/${products.length}`);
        } catch (e) {
          failed++;
          console.warn(`[skip] ${p.name.slice(0, 40)}: ${e instanceof Error ? e.message : e}`);
        }
      }
    }),
  );

  console.log(`\n✅ ${done} taggés, ${failed} échecs`);
  if (results.length <= 40) {
    console.log("\nCORE".padEnd(38) + "| COMPATIBLE".padEnd(38) + "| produit");
    console.log("\n" + results.map((r) => `${(r.tags.join(", ") || "—").padEnd(36)} | ${((r.compat ?? []).join(", ") || "—").padEnd(35)} | [${r.category}] ${r.name} (${r.merchant})`).join("\n"));
  }
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });
