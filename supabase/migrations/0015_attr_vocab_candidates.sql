-- ================================================================
-- α-15 : pool de candidats de vocabulaire (auto-enrichissement Étape 2)
-- ================================================================
-- Quand l'extraction d'un attribut enum renvoie "unknown", un appel Gemini LIBRE propose
-- un terme naturel → loggé ici. TRACE pour enrichir le référentiel (Notion) après dédup.
-- On NE promeut JAMAIS en direct (synonymes) : status reste 'new' jusqu'à validation.

create table if not exists public.attr_vocab_candidates (
  id uuid primary key default uuid_generate_v4(),
  category text not null,
  attribute text not null,
  label text not null,                 -- terme libre Gemini (lowercase/trim)
  count int not null default 1,
  example_product_id uuid,
  status text not null default 'new' check (status in ('new', 'promoted', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists uniq_vocab_candidate
  on public.attr_vocab_candidates(category, attribute, label);

-- Incrément atomique (insert-or-bump).
create or replace function bump_vocab_candidate(
  p_category text, p_attribute text, p_label text, p_example uuid
) returns void language sql as $$
  insert into public.attr_vocab_candidates(category, attribute, label, example_product_id)
  values (p_category, p_attribute, p_label, p_example)
  on conflict (category, attribute, label)
  do update set count = attr_vocab_candidates.count + 1, updated_at = now();
$$;
