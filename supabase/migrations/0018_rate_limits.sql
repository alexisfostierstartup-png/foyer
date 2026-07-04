-- 0018 — Rate limiting par IP (fenêtre fixe) pour les routes coûteuses en IA.
-- Les utilisateurs anonymes ne sont pas identifiables (pas de user_id) → on limite
-- par IP pour éviter l'abus de génération (dépense Gemini). Table service-role only.

create table if not exists public.rate_limits (
  ip text not null,
  bucket text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (ip, bucket, window_start)
);

-- RLS activée SANS policy → seul le service-role (serveur) y accède ; l'anon key
-- publique ne peut ni lire ni écrire cette table.
alter table public.rate_limits enable row level security;

-- Incrément atomique + verdict, en un seul aller-retour. La fenêtre est calculée
-- côté DB (now()) pour être cohérente entre instances serverless.
create or replace function public.rate_limit_hit(
  p_ip text,
  p_bucket text,
  p_window_seconds int,
  p_limit int
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_count int;
begin
  insert into public.rate_limits (ip, bucket, window_start, count)
  values (p_ip, p_bucket, v_window, 1)
  on conflict (ip, bucket, window_start)
  do update set count = public.rate_limits.count + 1
  returning count into v_count;
  return v_count <= p_limit;  -- true = autorisé
end;
$$;
