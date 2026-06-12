-- Biens immobiliers gérés par un Pro
create table public.pro_properties (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  address text not null,
  property_type text not null check (property_type in ('studio', 't2', 't3', 't4', 't5plus', 'maison', 'commercial', 'other')),
  surface_m2 numeric,
  notes text,
  status text default 'active' check (status in ('active', 'archived', 'sold_rented')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_properties_owner on public.pro_properties(owner_id, status, created_at desc);

-- Pièces d'un bien
create table public.pro_property_rooms (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.pro_properties(id) on delete cascade,
  name text not null,
  room_type text not null,
  photo_urls text[] not null default '{}',
  primary_photo_url text,
  sort_order int default 0,
  created_at timestamptz not null default now()
);
create index idx_rooms_property on public.pro_property_rooms(property_id, sort_order);

-- Jobs de génération
create table public.pro_generation_jobs (
  id uuid primary key default uuid_generate_v4(),
  property_id uuid not null references public.pro_properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  mode text not null default 'standard' check (mode in ('standard', 'reconstruction_3d', 'before_after_sale')),
  rooms_selected uuid[] not null,
  ambiances_selected text[] not null,
  global_constraints text,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  total_renders int not null,
  completed_renders int default 0,
  failed_renders int default 0,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_jobs_property on public.pro_generation_jobs(property_id, created_at desc);
create index idx_jobs_user on public.pro_generation_jobs(user_id, created_at desc);

-- Résultats individuels d'un job
create table public.pro_renders (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references public.pro_generation_jobs(id) on delete cascade,
  room_id uuid not null references public.pro_property_rooms(id) on delete cascade,
  ambiance_slug text not null,
  source_photo_url text not null,
  render_url text,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  error_message text,
  is_favorite boolean default false,
  alterations jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index idx_renders_job on public.pro_renders(job_id);
create index idx_renders_room on public.pro_renders(room_id);

-- Templates Pro
create table public.pro_templates (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  ambiance_slugs text[] not null,
  custom_constraints jsonb,
  created_at timestamptz not null default now()
);

-- Clients finaux d'un Pro
create table public.pro_clients (
  id uuid primary key default uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  notes text,
  created_at timestamptz not null default now()
);

-- Liens partageables publics
create table public.pro_share_links (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid not null references public.pro_generation_jobs(id) on delete cascade,
  slug text not null unique,
  client_id uuid references public.pro_clients(id),
  view_count int default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index idx_share_links_slug on public.pro_share_links(slug);

-- RLS
alter table public.pro_properties enable row level security;
alter table public.pro_property_rooms enable row level security;
alter table public.pro_generation_jobs enable row level security;
alter table public.pro_renders enable row level security;
alter table public.pro_templates enable row level security;
alter table public.pro_clients enable row level security;
alter table public.pro_share_links enable row level security;

create policy "pros see their own properties" on public.pro_properties for all using (auth.uid() = owner_id);
create policy "pros see rooms of their properties" on public.pro_property_rooms for all using (
  exists (select 1 from public.pro_properties p where p.id = property_id and p.owner_id = auth.uid())
);
create policy "pros see their own jobs" on public.pro_generation_jobs for all using (auth.uid() = user_id);
create policy "pros see renders of their jobs" on public.pro_renders for all using (
  exists (select 1 from public.pro_generation_jobs j where j.id = job_id and j.user_id = auth.uid())
);
create policy "pros manage their templates" on public.pro_templates for all using (auth.uid() = owner_id);
create policy "pros manage their clients" on public.pro_clients for all using (auth.uid() = owner_id);
create policy "pros manage their share links" on public.pro_share_links for all using (
  exists (select 1 from public.pro_generation_jobs j where j.id = job_id and j.user_id = auth.uid())
);
create policy "public reads non-expired share links" on public.pro_share_links for select using (
  expires_at is null or expires_at > now()
);
