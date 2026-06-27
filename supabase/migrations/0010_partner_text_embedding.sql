-- ================================================================
-- α-11 : embedding TEXTE produit (terme sémantique du blend matching)
-- ================================================================
-- Le terme TEXTE rattrape l'image quand celle-ci trompe (élément vu de dos,
-- occlusion, photo médiocre). text_embedding = jina-clip-v2 de buildProductText
-- (name + description + specs). Peuplé par le sync (ingest.ts) ET le backfill.
-- (colonne déjà présente en base ; `if not exists` rend la migration rejouable.)

alter table public.partner_products
  add column if not exists text_embedding vector(1024);

-- 2e index vectoriel : accélère les requêtes texte-seul (fallback crop null) et le
-- pré-tri. Le blend (2 cosines additionnés) ne peut pas s'appuyer sur un index ANN
-- unique, mais à ~4k lignes le seqscan reste <10ms.
create index if not exists idx_partner_products_text_embedding
  on public.partner_products using ivfflat (text_embedding vector_cosine_ops)
  with (lists = 100);
