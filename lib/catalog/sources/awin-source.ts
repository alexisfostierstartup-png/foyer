/**
 * AwinSource — source de PRODUCTION (flux d'affiliation Awin) — STUB.
 *
 * Raison d'être : rendre EXPLICITE que la source de prod implémentera la MÊME
 * interface ProductSource que la source de test (PiloterrSource). L'ingestion
 * (lib/catalog/ingest.ts) est totalement agnostique de la source → le jour du
 * passage en prod, on remplace simplement `new PiloterrSource(...)` par
 * `new AwinSource(...)` dans le script de sync, sans rien changer à l'ingestion.
 *
 * La logique de fetch des flux Awin existe déjà côté lib/shopping/sync.ts
 * (fetchAwinFeed + AWIN_MERCHANT_IDS) ; ce stub sera relié à cette logique
 * quand on basculera la prod sur Awin.
 */
import type { ProductSource, PartnerProductInput } from "../types";

export class AwinSource implements ProductSource {
  constructor(public readonly merchant: string) {}

  async fetchProducts(category: string, limit: number): Promise<PartnerProductInput[]> {
    void category;
    void limit;
    throw new Error(
      "AwinSource: stub. La source de prod sera branchée sur le flux Awin " +
        "(cf. lib/shopping/sync.ts fetchAwinFeed) — même interface ProductSource.",
    );
  }
}
