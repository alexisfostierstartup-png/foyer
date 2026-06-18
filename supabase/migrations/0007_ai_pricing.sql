create table public.ai_pricing (
  id                    uuid        primary key default uuid_generate_v4(),
  provider              text        not null,
  model                 text,                         -- null = any model from this provider
  per_1m_input_tokens   numeric,
  per_1m_output_tokens  numeric,
  per_image_in          numeric,
  per_image_out         numeric,
  per_request           numeric,
  per_1k_embeddings     numeric,
  notes                 text,
  is_active             boolean     not null default true,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- One entry per (provider, model) pair
create unique index uniq_ai_pricing_key
  on public.ai_pricing(provider, coalesce(model, ''));

alter table public.ai_pricing enable row level security;

-- ── Seed with current hardcoded defaults ──────────────────────────────────────

insert into public.ai_pricing
  (provider, model, per_1m_input_tokens, per_1m_output_tokens, per_image_in, per_image_out, notes)
values
  ('gemini_vision', 'gemini-2.5-flash-lite', 0.10,  0.40,  0.001316, null,   'Vision/text — Gemini 2.5 Flash Lite (juin 2025)'),
  ('gemini_vision', 'gemini-2.5-flash',      0.30,  2.50,  null,     null,   'Vision/text — Gemini 2.5 Flash avec thinking (legacy)'),
  ('nano_banana',   'gemini-2.5-flash-image', 0.10, null,  0.001316, 0.039,  'Génération image — Gemini 2.5 Flash Image'),
  ('flux_kontext',  'flux-kontext-pro',       null,  null,  null,     0.055,  'Édition image — Flux Kontext Pro (pas encore actif)'),
  ('jina',          'jina-embeddings-v3',     null,  null,  null,     null,   'Embeddings Jina v3'),
  ('piloterr',      'scraper',                null,  null,  null,     null,   'Scraping Piloterr par requête');

update public.ai_pricing set per_1k_embeddings = 0.00002 where provider = 'jina';
update public.ai_pricing set per_request = 0.001         where provider = 'piloterr';
update public.ai_pricing set is_active = false            where provider = 'flux_kontext';
