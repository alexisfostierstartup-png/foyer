-- Extensions (already installed on Supabase, no-ops)
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ================================================================
-- Table : projects
-- ================================================================
create table public.projects (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  room_type text not null check (room_type in ('salon', 'chambre')),
  style_id text not null,
  source_image_url text,
  vision_output jsonb,
  user_instructions jsonb default '{}'::jsonb,
  current_render_url text,
  alterations jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_projects_user on public.projects(user_id);
create index idx_projects_created on public.projects(created_at desc);

-- ================================================================
-- Table : iterations
-- ================================================================
create table public.iterations (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  parent_render_url text not null,
  user_request text not null,
  result_url text,
  provider_used text not null,
  prompt_used text,
  created_at timestamptz not null default now()
);
create index idx_iterations_project on public.iterations(project_id);

-- ================================================================
-- Table : prompts
-- ================================================================
create table public.prompts (
  id uuid primary key default uuid_generate_v4(),
  slug text not null,
  purpose text not null check (purpose in ('generation', 'iteration', 'detection', 'audit', 'alterations')),
  conditions jsonb not null default '{}'::jsonb,
  template text not null,
  provider text not null check (provider in ('nano_banana', 'flux_kontext', 'gemini_vision', 'seedream')),
  is_active boolean not null default true,
  version int not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- un seul actif par couple (slug, purpose)
create unique index uniq_prompts_active on public.prompts(slug, purpose) where (is_active = true);

-- ================================================================
-- Table : prompt_versions (audit log complet)
-- ================================================================
create table public.prompt_versions (
  id uuid primary key default uuid_generate_v4(),
  prompt_id uuid not null references public.prompts(id) on delete cascade,
  slug text not null,
  purpose text not null,
  conditions jsonb not null,
  template text not null,
  provider text not null,
  version int not null,
  notes text,
  saved_by text,
  saved_at timestamptz not null default now()
);
create index idx_prompt_versions_prompt on public.prompt_versions(prompt_id, version desc);

-- ================================================================
-- Table : assets (données éditoriales : ambiances, defaults, presets, palettes)
-- ================================================================
create table public.assets (
  id uuid primary key default uuid_generate_v4(),
  category text not null check (category in ('ambiance', 'room_defaults', 'floor_preset', 'wall_palette')),
  slug text not null,
  data jsonb not null,
  is_active boolean not null default true,
  sort_order int default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index uniq_assets_category_slug on public.assets(category, slug);
create index idx_assets_category on public.assets(category, is_active, sort_order);

-- ================================================================
-- Table : shopping_lists (V1 mock, V2 matching réel)
-- ================================================================
create table public.shopping_lists (
  id uuid primary key default uuid_generate_v4(),
  project_id uuid not null references public.projects(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  total_estimated numeric,
  score_foyer jsonb,
  created_at timestamptz not null default now()
);
create index idx_shopping_project on public.shopping_lists(project_id);

-- ================================================================
-- RLS — V1 permissif (sera durci en V2 avec auth)
-- ================================================================
alter table public.projects enable row level security;
alter table public.iterations enable row level security;
alter table public.prompts enable row level security;
alter table public.prompt_versions enable row level security;
alter table public.assets enable row level security;
alter table public.shopping_lists enable row level security;

create policy "allow all v1" on public.projects for all using (true) with check (true);
create policy "allow all v1" on public.iterations for all using (true) with check (true);
create policy "allow all v1" on public.prompts for all using (true) with check (true);
create policy "allow all v1" on public.prompt_versions for all using (true) with check (true);
create policy "allow all v1" on public.assets for all using (true) with check (true);
create policy "allow all v1" on public.shopping_lists for all using (true) with check (true);

-- Expose tables to Data API (anon + authenticated roles)
grant select, insert, update, delete on public.projects to anon, authenticated;
grant select, insert, update, delete on public.iterations to anon, authenticated;
grant select, insert, update, delete on public.prompts to anon, authenticated;
grant select, insert, update, delete on public.prompt_versions to anon, authenticated;
grant select, insert, update, delete on public.assets to anon, authenticated;
grant select, insert, update, delete on public.shopping_lists to anon, authenticated;

-- ================================================================
-- Trigger : updated_at
-- ================================================================
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_projects_touch
  before update on public.projects
  for each row execute function public.touch_updated_at();

create trigger trg_prompts_touch
  before update on public.prompts
  for each row execute function public.touch_updated_at();

create trigger trg_assets_touch
  before update on public.assets
  for each row execute function public.touch_updated_at();

-- ================================================================
-- Trigger : versioning automatique des prompts
-- ================================================================
create or replace function public.snapshot_prompt_version()
returns trigger language plpgsql as $$
begin
  insert into public.prompt_versions (prompt_id, slug, purpose, conditions, template, provider, version, notes)
  values (new.id, new.slug, new.purpose, new.conditions, new.template, new.provider, new.version, new.notes);
  return new;
end;
$$;

create trigger trg_prompts_snapshot
  after insert or update on public.prompts
  for each row execute function public.snapshot_prompt_version();
