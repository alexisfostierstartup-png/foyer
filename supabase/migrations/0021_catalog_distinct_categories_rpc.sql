-- Liste des catégories RÉELLEMENT présentes au catalogue (source de vérité), pour le
-- filtre admin/catalog — remplace une liste dérivée du schéma d'attributs (SCHEMA_V3) qui
-- omettait les catégories sans schéma dédié (curtains, cushion, bed, nightstand, paint,
-- seat_pad → schéma "default"). DISTINCT calculé côté Postgres : pas de plafond 1000 lignes
-- PostgREST (qui limiterait/biaiserait un SELECT brut sur une table de 25k+ lignes).
create or replace function public.distinct_catalog_categories()
returns table(category text)
language sql
stable
as $$
  select distinct category from public.partner_products order by category;
$$;
