-- ================================================================
-- α-11 : RPC blend CROP↔image + DESCRIPTION↔texte (2 vecteurs cible)
-- ================================================================
-- Cible = 2 signaux de la MÊME détection : le CROP de l'élément dans le rendu
-- (→ embedding image) et sa DESCRIPTION (→ embedding texte). Score par produit :
--     w · cosine(crop, image_embedding) + (1−w) · cosine(desc, text_embedding)
-- w (poids image) dépend de la SOURCE du produit (neuf vs occasion), résolu côté
-- app depuis assets.matching_weights et passé en paramètre. crop absent → w=0
-- (texte seul, dégradation propre). On renvoie les 2 cosines décomposés (calibration).
--
-- L'ancien RPC match_partner_products_hybrid est CONSERVÉ tant que le blend n'est pas
-- validé (rollback).

create or replace function match_partner_products_blend(
  crop_embedding vector(1024),   -- nullable : crop absent → texte seul
  desc_embedding vector(1024),
  match_category text,
  match_count int default 10,
  w_eco_new float default 0.7,
  w_secondhand float default 0.5
)
returns table (
  id uuid,
  name text,
  category text,
  description text,
  price numeric,
  product_url text,
  affiliate_url text,
  image_urls text[],
  primary_image_url text,
  style_affinity text[],
  source_type text,
  merchant text,
  partner_tier text,
  similarity float,
  sim_image float,
  sim_text float
)
language sql stable
as $$
  with scored as (
    select
      p.id, p.name, p.category, p.description, p.price, p.product_url, p.affiliate_url,
      p.image_urls, p.primary_image_url, p.style_affinity, p.source_type, p.merchant, p.partner_tier,
      -- poids image selon la source ; crop absent → 0 (texte seul)
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
    s_img as sim_image,
    s_txt as sim_text
  from scored
  order by (w_img * coalesce(s_img, 0) + (1 - w_img) * s_txt) desc
  limit match_count;
$$;

-- ================================================================
-- Config poids/seuils blend (data-driven, par catégorie × source)
-- ================================================================
-- Nouvelle catégorie de config dans assets → on étend la contrainte CHECK.
alter table public.assets drop constraint if exists assets_category_check;
alter table public.assets add constraint assets_category_check
  check (category = any (array[
    'ambiance', 'room_defaults', 'floor_preset', 'wall_palette',
    'standard_dims', 'element_category', 'matching_weights'
  ]));

insert into public.assets (category, slug, data, is_active, notes)
select v.category, v.slug, v.data, true, v.notes
from (values
  ('matching_weights', 'default',
   '{"image_weight": {"eco_new": 0.7, "secondhand": 0.5}, "min_score": {"eco_new": 0.7, "secondhand": 0.55}}'::jsonb,
   'Règle générale : neuf=image domine, occasion=rééquilibre vers texte.'),
  ('matching_weights', 'floor',
   '{"image_weight": {"eco_new": 0.45, "secondhand": 0.4}, "min_score": {"eco_new": 0.6, "secondhand": 0.5}}'::jsonb,
   'Sol : motif (chevron/point de hongrie/essence) se joue dans la description → on baisse w (image), le texte pèse plus.')
) as v(category, slug, data, notes)
where not exists (
  select 1 from public.assets a where a.category = v.category and a.slug = v.slug
);
