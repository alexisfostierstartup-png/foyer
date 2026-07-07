-- Flux DIY beta : colonnes additives, inertes pour le flux standard.
-- level        : niveau bricoleur requis (1 néophyte / 2 expérimenté / 3 confirmé)
-- renderable   : l'action peut être montrée fidèlement dans le rendu image
-- beta         : action visible uniquement dans le flux ?diy=beta (is_active=false pour elles)
-- beta_categories : extensions de catégories mergées UNIQUEMENT en mode beta
alter table diy_actions
  add column if not exists level smallint not null default 1,
  add column if not exists renderable boolean not null default true,
  add column if not exists beta boolean not null default false,
  add column if not exists beta_categories text[] not null default '{}';
