-- Profil utilisateur (étendu auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  plan text not null default 'neophyte' check (plan in ('neophyte', 'expert', 'pro')),
  stripe_customer_id text unique,
  stripe_subscription_id text,
  subscription_status text check (subscription_status in ('active', 'canceled', 'past_due', 'trialing', null)),
  current_period_end timestamptz,
  first_free_used boolean default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Wallet crédits (néophytes)
create table public.credit_wallet (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance int not null default 0,
  total_purchased int not null default 0,
  total_consumed int not null default 0,
  updated_at timestamptz not null default now()
);

-- Transactions (audit trail)
create table public.credit_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta int not null,
  reason text not null,
  related_project_id uuid,
  stripe_payment_intent_id text,
  created_at timestamptz not null default now()
);

create index idx_credit_txn_user on public.credit_transactions(user_id, created_at desc);

-- Ajouts à la table projects existante
alter table public.projects add column if not exists anon_id text;
alter table public.projects add column if not exists is_saved boolean default false;
alter table public.projects add column if not exists live_edits_used int default 0;

create index if not exists idx_projects_anon on public.projects(anon_id) where anon_id is not null;

-- Ajout à iterations (typer édition live vs classic)
alter table public.iterations add column if not exists iteration_type text default 'classic' check (iteration_type in ('classic', 'live_edit'));

-- Trigger : créer profile + wallet à l'inscription
create or replace function public.handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  insert into public.credit_wallet (user_id) values (new.id);
  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.credit_wallet enable row level security;
alter table public.credit_transactions enable row level security;

create policy "users see their own profile" on public.profiles for select using (auth.uid() = id);
create policy "users update their own profile" on public.profiles for update using (auth.uid() = id);
create policy "users see their own wallet" on public.credit_wallet for select using (auth.uid() = user_id);
create policy "users see their own txns" on public.credit_transactions for select using (auth.uid() = user_id);

-- Durcir RLS sur projects
drop policy if exists "allow all v1" on public.projects;
create policy "owners see their projects" on public.projects for select using (auth.uid() = user_id OR user_id is null);
create policy "anyone can create" on public.projects for insert with check (true);
create policy "owners update their projects" on public.projects for update using (auth.uid() = user_id OR user_id is null);
