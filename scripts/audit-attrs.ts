#!/usr/bin/env npx tsx
/**
 * AUDIT + PERSIST attrs Gemini + tags de style, FUSIONNÉS en un seul appel Vision par
 * produit quand les deux sont à faire (économise un fetch image + un appel Gemini par
 * rapport à deux scripts séparés — cf. scripts/backfill-style-tags.ts, absorbé ici).
 * Parallélisé (CONCURRENCY workers, défaut 6 — tier payant, 2026-07-14) : le "stop au 1er
 * unknown" reste garanti (juste avec un overshoot borné à CONCURRENCY-1 items déjà en vol
 * au moment du stop — jamais perdu, reprend proprement au restart).
 *
 * INDÉPENDANCE PRÉSERVÉE À DESSEIN : attrs et style sont deux marqueurs distincts
 * (metadata.attrs_model / metadata.style_tagged_at). Si un seul des deux manque pour un
 * produit (ex. vocab enrichi → re-run attrs seul sur des produits déjà stylés), le prompt
 * ne redemande QUE la partie manquante — pas de tokens de sortie gâchés sur l'autre partie,
 * pas de risque d'écraser une classification déjà bonne. Décision utilisateur 2026-07-11 :
 * standard pour toute future classification produit du catalogue.
 *
 * S'ARRÊTE (tout le run, pas juste la catégorie courante) :
 *  - au 1er "unknown" sur un enum attrs non accepté → affiche produit/image/attrs/attribut
 *    en cause, à corriger dans attributeSchemaV3.ts puis relancer (reprend sans perte).
 *    (le style n'a pas de notion d'"unknown" — tags multi-sélectifs, 0 accepté par design.)
 *  - si erreur quota/billing Gemini détectée → message clair "crédits épuisés".
 *
 * Usage :
 *   npx tsx scripts/audit-attrs.ts --merchants=maisons_du_monde,cyrillus [--lite]
 *     [--categories=sofa,armchair,...] [--accept=legs_material] [--coerce=legs_type:none]
 *     [--no-style]   # désactive le volet style (attrs seul, comportement pré-fusion)
 *     [--concurrency=N]   # défaut 6 (tier payant)
 *     [--free-tier]        # throttle 6.5s + concurrency forcée à 1 (tier gratuit Gemini)
 */
import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { readFile } from "fs/promises";
import path from "path";

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36";
// gemini-2.5-flash-lite n'est plus accessible aux nouvelles clés API ("no longer available
// to new users", 404, vérifié 2026-07-10) → alias stable "gemini-flash-lite-latest" (pointe
// sur gemini-3.1-flash-lite au moment du fix), survit aux dépréciations futures de version.
const MODEL = process.argv.includes("--lite") ? "gemini-flash-lite-latest" : "gemini-2.5-flash";

// Même ordre de priorité que scripts/import-effinity-7.ts (gros mobilier → luminaires → déco).
const DEFAULT_CATEGORIES = [
  "sofa", "armchair", "chair", "coffee_table", "dining_table", "side_table",
  "sideboard", "dresser", "bookshelf", "stool", "desk", "bed", "dressing_table", "nightstand",
  "bench", "pouf", "headboard", "display_cabinet", "tv_stand", "bar_cabinet", "room_divider",
  "rug", "curtains",
  "pendant_lamp", "table_lamp", "wall_sconce", "floor_lamp",
  "mirror", "vase", "decorative_object", "cushion",
];
// Catégories où le style n'apporte rien / bruite le dashboard (repris de backfill-style-tags.ts).
const STYLE_EXCLUDED_CATEGORIES = new Set(["paint", "floor", "floor_material"]);

function isQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /quota|billing|exceeded your current quota|insufficient/i.test(msg);
}

async function main() {
  const merchants = (process.argv.find((a) => a.startsWith("--merchants="))?.slice(12) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (merchants.length === 0) { console.error("Usage: audit-attrs.ts --merchants=m1,m2 [--categories=c1,c2] [--lite] [--accept=k1,k2] [--coerce=k:v,k2:v2] [--no-style]"); process.exit(1); }
  // slice("--categories=".length) — l'ancien slice(14) mangeait la 1re lettre
  // (« floor_lamp » → « loor_lamp ») → 0 produit sélectionné, en silence.
  const categories = (process.argv.find((a) => a.startsWith("--categories="))?.slice("--categories=".length) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const cats = categories.length > 0 ? categories : DEFAULT_CATEGORIES;
  const accept = new Set((process.argv.find((a) => a.startsWith("--accept="))?.slice(9) ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  const styleEnabled = !process.argv.includes("--no-style");
  const coerce: Record<string, string> = {};
  for (const pair of (process.argv.find((a) => a.startsWith("--coerce="))?.slice(9) ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const [k, v] = pair.split(":"); if (k && v) coerce[k] = v;
  }

  const { createSupabaseAdmin } = await import("../lib/supabase/server");
  const { getVisionProvider } = await import("../lib/ai/provider");
  const { withTracking } = await import("../lib/ai/track");
  const { getSchemaV3, schemaForCategory } = await import("../lib/shopping/attributeSchemaV3");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createSupabaseAdmin() as any;

  // 18 slugs canoniques + descripteur court (repris tel quel de backfill-style-tags.ts).
  const stylesJson = JSON.parse(await readFile(path.join(process.cwd(), "data/styles.json"), "utf8"));
  const styleList: { slug: string; brief: string }[] = (Array.isArray(stylesJson) ? stylesJson : stylesJson.styles).map(
    (s: { slug: string; data: { mood?: string; name?: string } }) => ({
      slug: s.slug,
      brief: (s.data?.mood ?? s.data?.name ?? s.slug).split(",").slice(0, 3).join(","),
    }),
  );
  const validSlugs = new Set(styleList.map((s) => s.slug));

  console.log(`[audit-attrs] démarrage ${new Date().toISOString()} — marchands=${merchants.join(",")} modèle=${MODEL} catégories=${cats.length} style=${styleEnabled ? "on" : "off"}`);

  let grandTotal = 0, grandFail = 0;

  // Throttle tier GRATUIT Gemini (10 req/min, RESOURCE_EXHAUSTED
  // "GenerateRequestsPerMinutePerProjectPerModel-FreeTier") — plus d'actualité (compte
  // passé en payant, 2026-07-14 : c'était la vraie cause de la lenteur des runs précédents,
  // pas le modèle). Découplé de --lite (qui ne choisit plus que le modèle) : n'active le
  // throttle que si explicitement demandé via --free-tier, sinon 0 (le retry sur erreur
  // transitoire dans extract() encaisse un vrai 429 s'il survient).
  const RATE_LIMIT_MS = process.argv.includes("--free-tier") ? 6500 : 0;
  // Parallélisation (2026-07-14, tier payant) : plusieurs appels Gemini en vol à la fois.
  // Forcé à 1 sur --free-tier — le throttle ci-dessous (lastCallAt partagé) n'est PAS
  // safe en concurrence (deux workers pourraient lire le même lastCallAt avant qu'aucun
  // ne l'ait mis à jour, et passer en même temps malgré le throttle).
  const CONCURRENCY = process.argv.includes("--free-tier")
    ? 1
    : Number(process.argv.find((a) => a.startsWith("--concurrency="))?.slice("--concurrency=".length)) || 6;
  let lastCallAt = 0;
  async function throttle() {
    if (RATE_LIMIT_MS <= 0) return;
    const wait = lastCallAt + RATE_LIMIT_MS - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
  }

  // Construit UN SEUL prompt couvrant attrs et/ou style selon ce qui manque pour CE produit
  // — jamais les deux volets systématiquement : un produit qui n'a plus que le style à faire
  // ne fait pas régénérer les attrs (coût output inutile), et inversement.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function buildPrompt(schema: any[] | null, wantStyle: boolean): string {
    const blocks: string[] = [];
    const fields: string[] = [];
    if (schema) {
      blocks.push(
        `Décris l'OBJET PRINCIPAL de cette photo produit (ignore le fond/décor). Pour les MATIÈRES, juge ` +
        `l'APPARENCE VISUELLE (un placage/MDF effet bois = light_wood/dark_wood selon teinte). "unknown" si ` +
        `l'attribut S'APPLIQUE mais n'est pas déterminable depuis l'image. "n/a" si l'attribut NE S'APPLIQUE PAS. ` +
        `PIEDS : objet posé au sol sans pieds apparents → legs_type="none" ET legs_material="n/a" (n'invente pas de pieds).`,
      );
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const a of schema as any[]) {
        const base = a.type === "hex" ? `  "${a.key}": "#rrggbb (couleur dominante de l'objet)"` : `  "${a.key}": one of [${a.vocab.join(", ")}]`;
        fields.push(a.hint ? `${base}  — ${a.hint}` : base);
      }
    }
    if (wantStyle) {
      blocks.push(
        `Tu es aussi styliste déco exigeant. Classe ce produit sur nos 18 collections de styles (slug: définition) :\n` +
        styleList.map((s) => `- ${s.slug}: ${s.brief}`).join("\n") +
        `\n\n"style_core" = styles que ce produit INCARNE (0-3 slugs, [] SANS EXCEPTION si produit générique/fonctionnel ` +
        `sans parti pris esthétique — la sobriété n'est pas une identité de style). "style_compatible" = styles où il ` +
        `s'intègre sans détonner, jusqu'à 6 slugs, hors style_core. La marque est un indice, l'APPARENCE prime toujours. ` +
        `Ne mets jamais un style en core "parce qu'il pourrait aller" — c'est la définition de compatible.`,
      );
      fields.push(`  "style_core": ["slug", ...]`, `  "style_compatible": ["slug", ...]`);
    }
    return `${blocks.join("\n\n")}\nJSON STRICT :\n{\n${fields.join(",\n")}\n}`;
  }

  const extract = async (prompt: string, url: string): Promise<Record<string, unknown> | null> => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await throttle();
        const buf = Buffer.from(await (await fetch(url, { headers: { "User-Agent": UA, Accept: "image/jpeg,image/webp" } })).arrayBuffer());
        const res = await withTracking(
          { step: "other", provider: "gemini_vision", requestPayload: { model: MODEL, purpose: "attrs_and_style" } },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          () => getVisionProvider("gemini_vision").analyze(prompt, [buf as any], { model: MODEL }),
        );
        return (res.parsed ?? null) as Record<string, unknown> | null;
      } catch (e) {
        if (isQuotaError(e)) {
          console.error(`\n💳 CRÉDITS ÉPUISÉS (Gemini) — ${e instanceof Error ? e.message : e}`);
          console.error(`[audit-attrs] Arrêt — ${grandTotal} attrs déjà persistés (rien perdu), recharge puis relance la même commande pour reprendre.`);
          process.exit(3);
        }
        if (attempt === 0) await new Promise((r) => setTimeout(r, 800));
      }
    }
    return null;
  };

  for (const cat of cats) {
    const schema = getSchemaV3(schemaForCategory(cat));
    const enumKeys = schema.filter((a) => a.type === "enum").map((a) => a.key);
    const catStyleEnabled = styleEnabled && !STYLE_EXCLUDED_CATEGORIES.has(cat);

    for (const merchant of merchants) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: any[] = [];
      const PAGE = 1000;
      for (let from = 0; ; from += PAGE) {
        const { data } = await sb.from("partner_products")
          .select("id, name, description, category, primary_image_url, product_url, metadata")
          .eq("merchant", merchant).eq("category", cat).order("id").range(from, from + PAGE - 1);
        const page = data ?? [];
        rows.push(...page);
        if (page.length < PAGE) break;
      }
      if (rows.length === 0) continue;

      let done = 0, skipped = 0, fail = 0;
      const naCount: Record<string, number> = {};
      // stopInfo : posé par le PREMIER worker qui rencontre un unknown non accepté. Les
      // autres workers en cours à ce moment peuvent finir leur item courant (overshoot
      // borné à CONCURRENCY-1 items, déjà persistés durablement — jamais perdu au restart),
      // mais n'en reprennent pas de nouveau (`while (idx < rows.length && !stopInfo)`).
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let stopInfo: { p: any; out: Record<string, unknown>; unknowns: string[] } | null = null;

      let idx = 0; // curseur partagé — incrément synchrone, pas de race en JS mono-thread.
      const worker = async () => {
        while (idx < rows.length && !stopInfo) {
          const p = rows[idx++];
          const needAttrs = !p.metadata?.attrs_model;
          const needStyle = catStyleEnabled && !p.metadata?.style_tagged_at;
          if (!needAttrs && !needStyle) { skipped++; continue; }

          const prompt = buildPrompt(needAttrs ? schema : null, needStyle);
          const out = await extract(prompt, p.primary_image_url);
          if (!out) { fail++; grandFail++; console.log(`  ✗ extraction échouée — ${merchant}/${cat} — ${p.name}`); continue; }

          const update: Record<string, unknown> = {};
          let newMetadata = { ...(p.metadata ?? {}) };

          if (needAttrs) {
            for (const [k, v] of Object.entries(coerce)) if (String(out[k]).toLowerCase() === "unknown") out[k] = v;
            const unknowns = enumKeys.filter((k) => String(out[k]).toLowerCase() === "unknown" && !accept.has(k));
            for (const k of enumKeys) if (String(out[k]).toLowerCase() === "n/a") naCount[k] = (naCount[k] ?? 0) + 1;

            if (unknowns.length > 0) {
              if (!stopInfo) stopInfo = { p, out, unknowns };
              return;
            }
            const attrsOnly: Record<string, unknown> = {};
            for (const a of schema) attrsOnly[a.key] = out[a.key];
            // attrs_model vit UNIQUEMENT dans metadata (pas de colonne dédiée) — NE JAMAIS le
            // mettre dans `update` au niveau racine (bug 2026-07-11 : PostgREST rejette la requête
            // ENTIÈRE avec 400 "column not found", update() n'a pas de .select() donc l'erreur
            // était silencieusement ignorée → done++ compté alors que RIEN n'était persisté).
            newMetadata = { ...newMetadata, attrs: { ...(p.metadata?.attrs ?? {}), ...attrsOnly }, attrs_model: MODEL };
          }

          if (needStyle) {
            const core = [...new Set(((out.style_core as string[]) ?? []).filter((s) => validSlugs.has(s)))];
            const compatible = [...new Set(((out.style_compatible as string[]) ?? []).filter((s) => validSlugs.has(s) && !core.includes(s)))].slice(0, 6);
            update.style_affinity = core; // colonne réelle (text[]), OK au niveau racine
            newMetadata = { ...newMetadata, style_compatible: compatible, style_tagged_at: new Date().toISOString() };
          }

          const { error: updErr } = await sb.from("partner_products").update({ ...update, metadata: newMetadata }).eq("id", p.id);
          if (updErr) {
            fail++; grandFail++;
            console.log(`  ✗ PERSISTANCE ÉCHOUÉE — ${merchant}/${cat} — ${p.id} — ${updErr.message}`);
            continue;
          }
          done++; grandTotal++;
          if (done % 50 === 0) console.log(`  ${merchant}/${cat}: ${done}/${rows.length} (total global: ${grandTotal})`);
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, rows.length) }, () => worker()));

      if (stopInfo) {
        const { p, out, unknowns } = stopInfo as { p: typeof rows[number]; out: Record<string, unknown>; unknowns: string[] };
        console.log(`\n🛑 UNKNOWN — ${grandTotal} déjà persistés au total (${done} sur ${merchant}/${cat})`);
        console.log(`   Marchand/Cat : ${merchant} / ${cat}`);
        console.log(`   Produit      : ${p.name}`);
        console.log(`   Image        : ${p.primary_image_url}`);
        console.log(`   URL          : ${p.product_url}`);
        console.log(`   Attrs        : ${JSON.stringify(out)}`);
        console.log(`   ⚠️  unknown sur : ${unknowns.join(", ")}`);
        console.log(`   (n/a cumulés sur cette catégorie : ${JSON.stringify(naCount)})`);
        console.log(`   → enrichir attributeSchemaV3.ts (vocab manquant) puis RELANCER la même commande (reprend sans perte).`);
        process.exit(2);
      }
      console.log(`✓ ${merchant.padEnd(16)} ${cat.padEnd(15)} ${done} extraits · ${skipped} déjà faits · ${fail} échecs`);
    }
  }

  console.log(`\n[audit-attrs] TERMINÉ ${new Date().toISOString()} — ${grandTotal} produits traités, ${grandFail} échecs, coût: voir ai_calls (request_payload->>'purpose'='attrs_and_style').`);
  process.exit(0);
}
main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
