-- ================================================================
-- α-12 : registre des marchands (plateforme d'affiliation + commission)
-- ================================================================
-- Source de vérité par marchand : d'où vient le catalogue (Awin/Piloterr/direct),
-- l'id annonceur, le flux, et le % de commission → permet de suivre la perf commerciale
-- (clics product_click × commission). Onboarder un partenaire = 1 ligne ici, 0 code.

create table if not exists public.partner_merchants (
  merchant text primary key,                       -- slug (= partner_products.merchant)
  display_name text not null,
  affiliation_platform text not null default 'direct'
    check (affiliation_platform in ('awin', 'piloterr', 'direct', 'other')),
  advertiser_id text,                              -- Awin advertiser id (awinmid)
  feed_url text,                                   -- Create-a-Feed URL (CSV) ou null
  commission_pct numeric,                          -- % commission (ex. 8.5)
  commission_note text,                            -- ex. 'sur CA HT, hors retours'
  status text not null default 'active'
    check (status in ('active', 'pending', 'paused', 'inactive')),
  joined_at date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Marchands déjà présents (jeu de test scrapé via Piloterr) + partenaires Awin connus.
insert into public.partner_merchants (merchant, display_name, affiliation_platform, advertiser_id, commission_pct, status, notes)
values
  ('cdiscount',    'Cdiscount',    'piloterr', null,   null, 'active',  'Jeu de test (scrape Piloterr).'),
  ('leroy_merlin', 'Leroy Merlin', 'piloterr', null,   null, 'active',  'Jeu de test (scrape Piloterr).'),
  ('ikea',         'IKEA',         'piloterr', null,   null, 'active',  'Jeu de test (scrape Piloterr).'),
  ('manomano',     'ManoMano',     'awin',     '14190', null, 'inactive', 'Awin advertiser id connu (pas encore ingéré).'),
  ('castorama',    'Castorama',    'awin',     '2822',  null, 'inactive', 'Awin advertiser id connu (pas encore ingéré).'),
  ('la_redoute',   'La Redoute',   'awin',     '1460',  null, 'inactive', 'Awin advertiser id connu (pas encore ingéré).'),
  ('tapis_fr',     'tapis.fr',     'awin',     null,    null, 'pending',  'Partenaire Awin accepté — feed_url + commission à renseigner.')
on conflict (merchant) do nothing;

-- Le registre devient la référence : on relâche l'enum figé (qui obligeait une migration
-- à chaque nouveau marchand) au profit d'une FK vers partner_merchants.
alter table public.partner_products drop constraint if exists partner_products_merchant_check;
alter table public.partner_products
  add constraint partner_products_merchant_fk
  foreign key (merchant) references public.partner_merchants(merchant);
