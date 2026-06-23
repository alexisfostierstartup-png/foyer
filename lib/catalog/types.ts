// Contrat de SOURCE de produits — interchangeable (Piloterr = test, Awin = prod).
// L'ingestion (lib/catalog/ingest.ts) ne dépend que de cette interface.

// Les champs de partner_products SANS embedding ni id (l'ingestion les complète).
export type PartnerProductInput = {
  merchant: string;
  external_id: string;
  category: string;        // slug catégorie Foyer (sofa, rug, …)
  name: string;
  description?: string;
  price: number | null;
  currency?: string;
  product_url: string;
  affiliate_url?: string;  // lien tracké d'affiliation (ex. Awin aw_deep_link) → commissions
  image_urls: string[];
  primary_image_url: string;
  source_type: string;     // 'eco_new' pour le jeu de test
  // Extras spécifiques à la source (specs/dimensions, marque, état…) → fusionnés
  // dans le jsonb metadata par l'ingestion. Évite de tout entasser dans `name`.
  attributes?: Record<string, unknown>;
};

export interface ProductSource {
  readonly merchant: string;
  // STREAM : yield chaque produit dès qu'il est récupéré (jusqu'à `limit`) → l'ingestion
  // l'insère aussitôt (progression visible + une coupure ne perd que le produit en cours).
  fetchProducts(category: string, limit: number): AsyncIterable<PartnerProductInput>;
}
