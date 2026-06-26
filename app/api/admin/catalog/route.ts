import { NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Number(searchParams.get("limit") ?? "20"));
  const offset = (page - 1) * limit;
  const merchant = searchParams.get("merchant");
  const category = searchParams.get("category");
  const tier = searchParams.get("partner_tier");
  const source_type = searchParams.get("source_type");
  const availability = searchParams.get("availability_status");
  const search = searchParams.get("search");

  const supabase = createSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase as any)
    .from("partner_products")
    .select("id, name, category, merchant, price, partner_tier, source_type, availability_status, primary_image_url, last_synced_at, created_at, metadata", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (merchant) query = query.eq("merchant", merchant);
  if (category) query = query.eq("category", category);
  if (tier) query = query.eq("partner_tier", tier);
  if (source_type) query = query.eq("source_type", source_type);
  if (availability) query = query.eq("availability_status", availability);
  if (search) query = query.ilike("name", `%${search}%`);

  // Filtres par attribut structuré : ?attr_<clé>=<valeur> → metadata.attrs.<clé> = valeur
  // (ex. attr_shape=round). Permet de vérifier le matching (lister les produits d'un même
  // profil d'attrs et voir si un plus proche existait sans remonter).
  for (const [k, v] of searchParams.entries()) {
    if (k.startsWith("attr_") && v) {
      const attrKey = k.slice(5).replace(/[^a-z_]/gi, ""); // garde-fou injection
      if (attrKey) query = query.eq(`metadata->attrs->>${attrKey}`, v);
    }
  }

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data, count, page, limit });
}
