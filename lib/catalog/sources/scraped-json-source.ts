/**
 * ScrapedJsonSource — source GÉNÉRIQUE pour un marchand sans flux d'affiliation
 * exploitable (ex. Maisons du Monde = Effinity, intégration à construire). On
 * DÉCOUPLE le scraping (navigateur réel, contourne l'anti-bot) de l'ingestion :
 * le scraping écrit un JSON local de produits déjà normalisés, cette source le
 * relit et le passe à ingestFromSource INCHANGÉ (embeddings image+texte Jina,
 * dédup (merchant, external_id), merge metadata, throttle).
 *
 * Le JSON attendu = tableau de PartnerProductInput complets (merchant, external_id,
 * category, name, price, product_url, image_urls, primary_image_url, source_type,
 * attributes). On filtre juste par catégorie Foyer au yield.
 */
import { readFileSync } from "fs";
import type { ProductSource, PartnerProductInput } from "../types";

export class ScrapedJsonSource implements ProductSource {
  private items: PartnerProductInput[];

  constructor(public readonly merchant: string, jsonFile: string) {
    const parsed = JSON.parse(readFileSync(jsonFile, "utf8"));
    if (!Array.isArray(parsed)) throw new Error(`ScrapedJsonSource: ${jsonFile} n'est pas un tableau`);
    // Garde-fous : on n'ingère que des lignes complètes (l'ingestion exige
    // primary_image_url ; sans external_id la dédup ne peut pas fonctionner).
    this.items = parsed.filter(
      (p: PartnerProductInput) =>
        p && p.merchant === merchant && p.external_id && p.name && p.primary_image_url,
    );
    console.log(
      `[scraped:${merchant}] ${this.items.length}/${parsed.length} produits valides (external_id + name + image).`,
    );
  }

  async *fetchProducts(category: string, limit: number): AsyncGenerator<PartnerProductInput> {
    let n = 0;
    for (const p of this.items) {
      if (n >= limit) break;
      if (p.category !== category) continue;
      n++;
      yield p;
    }
    console.log(`[scraped:${this.merchant}] ${category}: ${n} produits`);
  }
}
