/**
 * AwinSource — source de PRODUCTION (flux d'affiliation Awin), même interface
 * ProductSource que la source de test → l'ingestion (lib/catalog/ingest.ts) est
 * inchangée (buildProductText + embeddings image/texte + affiliate_url tracké).
 *
 * Le flux vient d'une URL "Create-a-Feed" (CSV), stockée dans partner_merchants.feed_url
 * pour le marchand. Le lien d'affiliation TRACKÉ est la colonne aw_deep_link (commissions
 * attribuées au compte). On télécharge + parse le flux UNE fois (mémoïsé), puis on filtre
 * par catégorie Foyer.
 */
import { gunzipSync } from "zlib";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { parseCsv } from "../csv";
import { detectCategory } from "@/lib/shopping/sync";
import type { ProductSource, PartnerProductInput } from "../types";

// Colonnes Create-a-Feed attendues (à cocher dans Awin Toolbox → Create-a-Feed).
type AwinRow = Record<string, string>;

export class AwinSource implements ProductSource {
  private feedPromise: Promise<AwinRow[]> | null = null;
  constructor(public readonly merchant: string) {}

  private async loadFeed(): Promise<AwinRow[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = createSupabaseAdmin() as any;
    const { data, error } = await supabase
      .from("partner_merchants")
      .select("feed_url, affiliation_platform")
      .eq("merchant", this.merchant)
      .single();
    if (error || !data) throw new Error(`AwinSource: marchand '${this.merchant}' absent de partner_merchants (${error?.message ?? ""})`);
    if (data.affiliation_platform !== "awin") throw new Error(`AwinSource: '${this.merchant}' n'est pas un marchand Awin`);
    const feedUrl: string | null = data.feed_url;
    if (!feedUrl) throw new Error(`AwinSource: feed_url manquant pour '${this.merchant}' (Awin Create-a-Feed → URL CSV → partner_merchants.feed_url)`);

    const res = await fetch(feedUrl, { headers: { "User-Agent": "foyer-alpha-sync/1.0" } });
    if (!res.ok) throw new Error(`AwinSource: flux ${res.status} pour '${this.merchant}'`);
    let buf = Buffer.from(await res.arrayBuffer());
    // Gunzip si le flux est compressé (magic 1f 8b) — Create-a-Feed compression/gzip.
    if (buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
    const rows = parseCsv(buf.toString("utf8"));
    console.log(`[awin:${this.merchant}] flux: ${rows.length} lignes`);
    return rows;
  }

  private toInput(r: AwinRow): PartnerProductInput | null {
    const image = r.aw_image_url || r.merchant_image_url || "";
    const affiliate = r.aw_deep_link || "";
    const externalId = r.aw_product_id || r.merchant_product_id || "";
    const name = (r.product_name || "").trim();
    if (!image || !affiliate || !externalId || !name) return null;
    // Stock : si une colonne le précise et qu'il est nul, on saute.
    const stock = (r.in_stock || r.stock_status || "").toLowerCase();
    if (stock === "0" || stock === "out of stock" || stock === "no") return null;

    return {
      merchant: this.merchant,
      external_id: externalId,
      category: "", // résolue par fetchProducts (filtre catégorie Foyer)
      name: name.slice(0, 255),
      description: (r.description || r.product_short_description || "").slice(0, 2000) || undefined,
      price: parseFloat(r.search_price || r.store_price || "") || null,
      currency: r.currency || "EUR",
      product_url: r.merchant_deep_link || r.aw_deep_link,
      affiliate_url: affiliate, // lien TRACKÉ → commissions
      image_urls: [image],
      primary_image_url: image,
      source_type: "eco_new",
      attributes: {
        brand: r.brand_name || undefined,
        awin_category: r.merchant_product_category_path || undefined,
        platform: "awin",
      },
    };
  }

  async *fetchProducts(category: string, limit: number): AsyncGenerator<PartnerProductInput> {
    const rows = await (this.feedPromise ??= this.loadFeed());
    let n = 0;
    for (const r of rows) {
      if (n >= limit) break;
      const foyerCat = detectCategory(r.product_name || "", r.merchant_product_category_path);
      if (foyerCat !== category) continue;
      const input = this.toInput(r);
      if (!input) continue;
      input.category = category;
      n++;
      yield input;
    }
    console.log(`[awin:${this.merchant}] ${category}: ${n} produits`);
  }
}
