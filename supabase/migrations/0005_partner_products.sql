-- ================================================================
-- α-10 : Partner products + LBC cache + vector search
-- ================================================================

create extension if not exists vector;

-- ================================================================
-- Table : partner_products
-- ================================================================
create table public.partner_products (
  id uuid primary key default uuid_generate_v4(),
  external_id text,
  merchant text not null check (merchant in (
    'leroy_merlin', 'la_redoute', 'ikea', 'manomano', 'castorama',
    'maisons_du_monde', 'reborn', 'selency', 'other'
  )),
  category text not null,
  name text not null,
  description text,
  price numeric,
  currency text default 'EUR',
  product_url text not null,
  affiliate_url text,
  image_urls text[] not null default '{}',
  primary_image_url text not null,
  style_affinity text[] default '{}',
  source_type text not null check (source_type in ('eco_new', 'secondhand', 'eco_label_certified')),
  availability_status text default 'available' check (availability_status in (
    'available', 'low_stock', 'out_of_stock', 'discontinued'
  )),
  embedding vector(1024),
  last_synced_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  is_featured boolean default false,
  partner_tier text default 'standard' check (partner_tier in ('strategic', 'standard', 'discovery')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index uniq_partner_products_external
  on public.partner_products(merchant, external_id)
  where external_id is not null;

create index idx_partner_products_category
  on public.partner_products(category, source_type, availability_status);

create index idx_partner_products_merchant
  on public.partner_products(merchant, is_featured);

create index idx_partner_products_embedding
  on public.partner_products using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

alter table public.partner_products enable row level security;

create policy "public read available"
  on public.partner_products for select
  using (availability_status = 'available');

create policy "admin write"
  on public.partner_products for all
  using (false)
  with check (false);

-- ================================================================
-- Table : partner_sync_runs
-- ================================================================
create table public.partner_sync_runs (
  id uuid primary key default uuid_generate_v4(),
  merchant text not null,
  source text not null check (source in (
    'awin_feed', 'flexoffers_feed', 'partnerize_feed', 'manual', 'scraping'
  )),
  status text not null check (status in ('running', 'success', 'failed')),
  items_added int default 0,
  items_updated int default 0,
  items_marked_unavailable int default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index idx_partner_sync_merchant
  on public.partner_sync_runs(merchant, started_at desc);

-- ================================================================
-- Table : lbc_search_cache
-- ================================================================
create table public.lbc_search_cache (
  id uuid primary key default uuid_generate_v4(),
  category text not null,
  filters jsonb not null,
  filters_hash text not null,
  results jsonb not null,
  fetched_at timestamptz not null default now()
);

create unique index uniq_lbc_cache_hash on public.lbc_search_cache(filters_hash);
create index idx_lbc_cache_fetched on public.lbc_search_cache(fetched_at desc);

-- ================================================================
-- RPC : match_partner_products (vector similarity search)
-- ================================================================
create or replace function match_partner_products(
  query_embedding vector(1024),
  match_category text,
  match_count int default 10
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
  similarity float
)
language sql stable
as $$
  select
    id, name, category, description, price, product_url, affiliate_url,
    image_urls, primary_image_url, style_affinity, source_type, merchant, partner_tier,
    1 - (embedding <=> query_embedding) as similarity
  from public.partner_products
  where
    category = match_category
    and availability_status = 'available'
    and embedding is not null
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- ================================================================
-- Patch shopping_lists : ajouter matching_strategy
-- ================================================================
alter table public.shopping_lists
  add column if not exists matching_strategy text
  default 'mock_catalog'
  check (matching_strategy in ('mock_catalog', 'partner_products', 'lbc_live', 'hybrid'));
