/**
 * EffinityCsvSource — source pour les flux "Google Shopping" (délimiteur `;`, colonnes
 * id/title/link/image_link/price/category…) exportés via le réseau d'affiliation
 * Effinity (`link` = déjà un lien tracké `track.effiliation.com/...`). Format DIFFÉRENT
 * du CSV Awin "Create-a-Feed" (cf. AwinSource) : pas de aw_deep_link/aw_product_id.
 *
 * Fichier lu en LOCAL (premier import contrôlé, comme AwinSource.localFile) et parsé en
 * STREAMING (le parseur array-based lib/catalog/csv.ts OOM sur Selency ~233k lignes) —
 * on ne garde que les colonnes utiles à PartnerProductInput, tout le reste est jeté à la
 * volée. Un seul passage : bucketé par catégorie Foyer (lib/catalog/effinity-category-map)
 * dès le parsing, mémoïsé, pour éviter de re-scanner le fichier à chaque catégorie.
 */
import { createReadStream } from "fs";
import { resolveEffinityCategory, resolveCyrillusKidsCategory, CYRILLUS_AMBIGUOUS_BUCKETS, isKidsTitle } from "../effinity-category-map";
import type { ProductSource, PartnerProductInput } from "../types";

const WANTED_COLUMNS = [
  "id",
  "title",
  "description",
  "link",
  "image_link",
  "additional_image_link",
  "price",
  "availability",
  "condition",
  "brand",
  "color",
  "material",
  "category",
  "category_level2",
  "category_level3",
  "category_level4",
] as const;

type RawRow = Record<(typeof WANTED_COLUMNS)[number], string>;

async function streamRows(path: string, onRow: (row: RawRow) => void): Promise<void> {
  let header: string[] = [];
  let wantIdx: Partial<Record<string, number>> = {};
  let field = "";
  let rowFields: string[] = [];
  let inQuotes = false;
  let rowIndex = 0;
  let firstChunk = true;

  function endField() {
    rowFields.push(field);
    field = "";
  }
  function endRow() {
    endField();
    if (rowIndex === 0) {
      header = rowFields.map((h) => h.trim());
      for (const col of WANTED_COLUMNS) wantIdx[col] = header.indexOf(col);
    } else if (!(rowFields.length === 1 && rowFields[0] === "")) {
      const row = {} as RawRow;
      for (const col of WANTED_COLUMNS) {
        const idx = wantIdx[col] ?? -1;
        row[col] = idx >= 0 ? (rowFields[idx] || "").trim() : "";
      }
      onRow(row);
    }
    rowIndex++;
    rowFields = [];
  }

  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path, { encoding: "utf8", highWaterMark: 1 << 20 });
    stream.on("data", (chunkRaw) => {
      let chunk = chunkRaw as string;
      if (firstChunk) {
        firstChunk = false;
        if (chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1);
      }
      for (let i = 0; i < chunk.length; i++) {
        const c = chunk[i];
        if (inQuotes) {
          if (c === '"') {
            if (chunk[i + 1] === '"') { field += '"'; i++; }
            else inQuotes = false;
          } else field += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ";") endField();
        else if (c === "\n") endRow();
        else if (c === "\r") { /* skip, \n suivant clôt la ligne */ }
        else field += c;
      }
    });
    stream.on("end", () => {
      if (field.length > 0 || rowFields.length > 0) endRow();
      resolve();
    });
    stream.on("error", reject);
  });
}

function isOutOfStock(row: RawRow): boolean {
  const v = row.availability.toLowerCase();
  return v === "0" || v === "out of stock" || v === "no" || v === "false";
}

// Décode le paramètre `url=` du lien tracké Effinity pour obtenir l'URL marchand brute
// (affichage/debug) ; le lien tracké complet reste affiliate_url (rémunération).
function extractRawUrl(trackedLink: string): string {
  const m = trackedLink.match(/[?&]url=([^&]+)/);
  if (!m) return trackedLink;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return trackedLink;
  }
}

export class EffinityCsvSource implements ProductSource {
  private bucketsPromise: Promise<Map<string, PartnerProductInput[]>> | null = null;

  /**
   * @param merchant slug partner_merchants (doit déjà exister, FK partner_products_merchant_fk)
   * @param localFile chemin du CSV `;` téléchargé (Downloads)
   * @param sourceType 'secondhand' pour un marchand de seconde main (ex. Selency), sinon 'eco_new'
   */
  constructor(
    public readonly merchant: string,
    private readonly localFile: string,
    private readonly sourceType: "eco_new" | "secondhand" | "eco_label_certified" = "eco_new",
  ) {}

  private toInput(row: RawRow, category: string): PartnerProductInput | null {
    if (!row.link || !row.image_link || !row.title || !row.id) return null;
    if (isOutOfStock(row)) return null;

    const images = [row.image_link, row.additional_image_link].filter(Boolean);
    const price = parseFloat(row.price.replace(",", ".")) || null;

    return {
      merchant: this.merchant,
      external_id: row.id,
      category,
      name: row.title.slice(0, 255),
      description: row.description.slice(0, 2000) || undefined,
      price,
      currency: "EUR",
      product_url: extractRawUrl(row.link),
      affiliate_url: row.link, // déjà trackée Effinity (track.effiliation.com)
      image_urls: [...new Set(images)],
      primary_image_url: row.image_link,
      source_type: row.condition.toLowerCase() === "used" ? "secondhand" : this.sourceType,
      attributes: {
        brand: row.brand || undefined,
        couleur: row.color || undefined,
        matiere: row.material || undefined,
        raw_category: [row.category, row.category_level2, row.category_level3, row.category_level4]
          .filter(Boolean)
          .join(" > ") || undefined,
        platform: "effinity",
      },
    };
  }

  private async loadBuckets(): Promise<Map<string, PartnerProductInput[]>> {
    const buckets = new Map<string, PartnerProductInput[]>();
    let total = 0;
    let mapped = 0;
    await streamRows(this.localFile, (row) => {
      total++;
      const pathOrTitle = [row.category, row.category_level2, row.category_level3, row.category_level4]
        .filter(Boolean)
        .join(" > ") || row.title;
      let category = resolveEffinityCategory(pathOrTitle);
      // Cyrillus « partie enfant » (2026-07-12) : rayons trop génériques pour le résolveur
      // par chemin (cf. commentaire resolveCyrillusKidsCategory) → second passage PAR TITRE,
      // scopé à ce marchand + ces rayons précis uniquement.
      if (!category && this.merchant === "cyrillus" && CYRILLUS_AMBIGUOUS_BUCKETS.has(row.category.trim().toLowerCase())) {
        category = resolveCyrillusKidsCategory(row.title);
      } else if (category && isKidsTitle(row.title)) {
        // Garde-fou général (2026-07-12) : un produit enfant peut atterrir dans une
        // catégorie adulte correctement mappée par le CHEMIN (ex. MdM "Literie > Lits" →
        // bed) alors que seul le TITRE trahit "enfant" ("Lit princesse enfant LED").
        // Exclu du pool adulte pour ne pas polluer le matching salon/chambre — pas
        // supprimé pour autant, juste non importé ici (candidat pour un futur mapping
        // chambre_enfant dédié, cf. resolveCyrillusKidsCategory).
        category = null;
      }
      if (!category) return;
      const input = this.toInput(row, category);
      if (!input) return;
      mapped++;
      const arr = buckets.get(category) ?? [];
      arr.push(input);
      buckets.set(category, arr);
    });
    console.log(`[effinity:${this.merchant}] ${total} lignes lues, ${mapped} mappées sur ${buckets.size} catégories`);
    return buckets;
  }

  async *fetchProducts(category: string, limit: number): AsyncGenerator<PartnerProductInput> {
    const buckets = await (this.bucketsPromise ??= this.loadBuckets());
    const items = buckets.get(category) ?? [];
    let n = 0;
    for (const item of items) {
      if (n >= limit) break;
      n++;
      yield item;
    }
    console.log(`[effinity:${this.merchant}] ${category}: ${n}/${items.length} produits (limit=${limit})`);
  }
}
