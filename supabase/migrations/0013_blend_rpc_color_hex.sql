-- ================================================================
-- α-13 : terme COULEUR (hex/ΔE) — la RPC blend expose color_hex produit
-- ================================================================
-- metadata.color_hex = couleur dominante du produit (backfill-color-hex, sharp).
-- L'app re-classe le top-N en ajoutant une proximité couleur (ΔE CIELAB) entre la
-- couleur de l'élément (lue par Gemini sur le rendu) et celle du produit — pas un match
-- exact, une latitude perceptuelle (colorScore = max(0, 1 − ΔE/seuil)).
-- (Le ΔE se calcule côté app : SQL n'a pas CIELAB nativement.)

drop function if exists match_partner_products_blend(vector, vector, text, integer, double precision, double precision);

create function match_partner_products_blend(
  crop_embedding vector(1024),
  desc_embedding vector(1024),
  match_category text,
  match_count int default 10,
  w_eco_new float default 0.7,
  w_secondhand float default 0.5
)
returns table (
  id uuid, name text, category text, description text, price numeric,
  product_url text, affiliate_url text, image_urls text[], primary_image_url text,
  style_affinity text[], source_type text, merchant text, partner_tier text,
  similarity float, sim_image float, sim_text float, color_hex text
)
language sql stable
as $$
  with scored as (
    select
      p.id, p.name, p.category, p.description, p.price, p.product_url, p.affiliate_url,
      p.image_urls, p.primary_image_url, p.style_affinity, p.source_type, p.merchant, p.partner_tier,
      p.metadata->>'color_hex' as color_hex,
      case
        when crop_embedding is null then 0::float
        when p.source_type = 'secondhand' then w_secondhand
        else w_eco_new
      end as w_img,
      case when crop_embedding is null then null::float
           else 1 - (p.embedding <=> crop_embedding) end as s_img,
      1 - (coalesce(p.text_embedding, p.embedding) <=> desc_embedding) as s_txt
    from public.partner_products p
    where p.category = match_category
      and p.availability_status = 'available'
      and p.embedding is not null
  )
  select
    id, name, category, description, price, product_url, affiliate_url,
    image_urls, primary_image_url, style_affinity, source_type, merchant, partner_tier,
    (w_img * coalesce(s_img, 0) + (1 - w_img) * s_txt) as similarity,
    s_img as sim_image, s_txt as sim_text, color_hex
  from scored
  order by (w_img * coalesce(s_img, 0) + (1 - w_img) * s_txt) desc
  limit match_count;
$$;
