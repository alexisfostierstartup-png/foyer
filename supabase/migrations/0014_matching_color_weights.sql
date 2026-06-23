-- ================================================================
-- α-14 : poids COULEUR par catégorie (stopgap avant attributs structurés)
-- ================================================================
-- La couleur seule est "form-blind" : forte, elle promeut un objet même-couleur de
-- mauvaise FORME (cube blanc vs table ronde, fauteuil à bascule vs scandinave même beige).
-- Donc poids couleur FORT là où la couleur discrimine (canapé/tapis/rideaux) et FAIBLE là
-- où la forme prime (table/fauteuil). Réglage fin déféré à l'Étape 2 (attributs structurés).

update public.assets set data = data || '{"color":{"weight":0.15,"threshold":28}}'::jsonb, updated_at=now()
  where category='matching_weights' and slug='default';
update public.assets set data = data || '{"color":{"weight":0.20,"threshold":28}}'::jsonb, updated_at=now()
  where category='matching_weights' and slug='floor';

insert into public.assets (category, slug, data, is_active, notes)
select 'matching_weights', v.slug, v.data, true, v.note
from (values
  ('sofa',         '{"color":{"weight":0.30,"threshold":28}}'::jsonb, 'couleur discrimine'),
  ('rug',          '{"color":{"weight":0.30,"threshold":28}}'::jsonb, 'couleur clé tapis'),
  ('curtains',     '{"color":{"weight":0.30,"threshold":28}}'::jsonb, 'couleur dominante'),
  ('bed',          '{"color":{"weight":0.18,"threshold":28}}'::jsonb, 'modéré'),
  ('dresser',      '{"color":{"weight":0.15,"threshold":28}}'::jsonb, 'modéré'),
  ('nightstand',   '{"color":{"weight":0.15,"threshold":28}}'::jsonb, 'modéré'),
  ('tv_stand',     '{"color":{"weight":0.15,"threshold":28}}'::jsonb, 'modéré'),
  ('bookshelf',    '{"color":{"weight":0.12,"threshold":28}}'::jsonb, 'forme prime'),
  ('armchair',     '{"color":{"weight":0.08,"threshold":28}}'::jsonb, 'forme prime'),
  ('coffee_table', '{"color":{"weight":0.04,"threshold":28}}'::jsonb, 'forme prime (couleur quasi off)'),
  ('side_table',   '{"color":{"weight":0.04,"threshold":28}}'::jsonb, 'forme prime')
) as v(slug, data, note)
where not exists (select 1 from public.assets a where a.category='matching_weights' and a.slug=v.slug);
