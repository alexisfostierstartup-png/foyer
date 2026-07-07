-- Flux DIY beta — data seed (inerte pour le flux standard) :
-- 1) Métadonnées level/renderable/beta_categories sur les 15 actions existantes.
--    NB : on ne touche PAS à leurs style_affinity (les négatifs changeraient le
--    tri du flux standard) — les exclusions dures des actions existantes seront
--    posées au merge standard, pas pendant le test beta.
-- 2) 19 nouvelles actions : is_active=false (invisibles du flux standard),
--    beta=true (visibles du flux ?diy=beta). Exceptions : radiator_cover et
--    paint_radiator dormantes (beta=false) — elles exigent d'abord le mécanisme
--    de dérogation nominative dans le prompt (règle radiateur intouchable).
-- Convention style_affinity : valeur négative = exclusion dure (filtre beta).

-- ── 1. Actions existantes ────────────────────────────────────────────────────
update diy_actions set level = 1, renderable = true,
  beta_categories = '{sideboard,cabinet,console_table,desk,dining_table,bar_table,stool,bed,ceiling}'
  where slug = 'repaint';
update diy_actions set level = 1, renderable = false where slug = 'wallpaper';
update diy_actions set level = 2, renderable = true  where slug = 'fresco_wall';
update diy_actions set level = 1, renderable = true  where slug = 'add_moldings';
update diy_actions set level = 2, renderable = true  where slug = 'install_wainscoting';
update diy_actions set level = 1, renderable = false where slug = 'apply_adhesive_tiles';
update diy_actions set level = 1, renderable = true  where slug = 'add_curtain_rail';
update diy_actions set level = 3, renderable = true  where slug = 'refinish_floor';
update diy_actions set level = 3, renderable = true  where slug = 'lay_tiles';
update diy_actions set level = 1, renderable = true,
  beta_categories = '{sideboard,cabinet,console_table,desk,dining_table,bar_table}'
  where slug = 'stain_wood';
update diy_actions set level = 2, renderable = true,
  beta_categories = '{sideboard,cabinet}'
  where slug = 'add_cane_insert';
update diy_actions set level = 1, renderable = false,
  beta_categories = '{sideboard,cabinet,desk,console_table}'
  where slug = 'replace_hardware';
update diy_actions set level = 1, renderable = false where slug = 'stencil_decor';
update diy_actions set level = 3, renderable = false where slug = 'reupholster';
update diy_actions set level = 1, renderable = true  where slug = 'add_slat_headboard';

-- ── 2. Nouvelles actions (beta) ──────────────────────────────────────────────
insert into diy_actions
  (slug, label, label_en, applies_to_categories, requires, qty_formula, qty_unit, style_affinity, supplies_template, is_active, beta, level, renderable)
values
  ('slat_wall', 'Mur de tasseaux', 'wood slat wall',
   '{wall}', '{}', 'area_m2', 'm²',
   '{"japandi": 0.9, "scandinave": 0.85, "quiet-luxury": 0.8, "industriel": 0.75, "memphis": -1, "cottage-anglais": -1, "haussmannien": -1}',
   '[{"name": "Tasseaux bois", "unit": "unité", "qty_formula": "area_m2 * 8"}, {"name": "Colle ou vis de fixation", "unit": "unité", "qty_formula": "area_m2 * 10"}, {"name": "Scie à onglet", "unit": "unité", "qty_formula": "1"}]',
   false, true, 1, true),

  ('paint_halfwall', 'Soubassement / demi-mur / arche peinte', 'painted half-wall or arch',
   '{wall}', '{}', 'area_m2', 'L',
   '{"color-block": 0.95, "memphis": 0.9, "seventies": 0.85, "quiet-luxury": -1, "wabi-sabi": -1}',
   '[{"name": "Peinture acrylique", "unit": "L", "qty_formula": "area_m2 * 0.05"}, {"name": "Ruban de masquage", "unit": "unité", "qty_formula": "1"}, {"name": "Rouleau + pinceau de rechampi", "unit": "unité", "qty_formula": "1"}]',
   false, true, 1, true),

  ('paint_floor', 'Peindre le sol', 'painted floor',
   '{floor}', '{"material_family": ["wood", "stone", "ceramic", "paint", "plastic"]}', 'area_m2', 'L',
   '{"quiet-luxury": -1}',
   '[{"name": "Peinture sol", "unit": "L", "qty_formula": "area_m2 * 0.12"}, {"name": "Primaire d''accroche", "unit": "L", "qty_formula": "area_m2 * 0.1"}, {"name": "Rouleau", "unit": "unité", "qty_formula": "1"}]',
   false, true, 1, true),

  ('lay_click_vinyl', 'Poser un sol vinyle clipsable', 'click vinyl flooring',
   '{floor}', '{"material_family": ["wood", "stone", "ceramic", "paint", "plastic"]}', 'area_m2', 'm²',
   '{}',
   '[{"name": "Lames vinyle clipsables", "unit": "m²", "qty_formula": "area_m2 * 1.1"}, {"name": "Sous-couche", "unit": "m²", "qty_formula": "area_m2"}, {"name": "Cutter + cale de frappe", "unit": "unité", "qty_formula": "1"}]',
   false, true, 1, true),

  ('lay_floating_parquet', 'Poser un parquet flottant clipsable', 'floating click parquet',
   '{floor}', '{"material_family": ["wood", "stone", "ceramic", "paint", "plastic"]}', 'area_m2', 'm²',
   '{}',
   '[{"name": "Lames parquet stratifié ou contrecollé", "unit": "m²", "qty_formula": "area_m2 * 1.1"}, {"name": "Sous-couche", "unit": "m²", "qty_formula": "area_m2"}, {"name": "Kit de pose (cale, tire-lame)", "unit": "unité", "qty_formula": "1"}]',
   false, true, 1, true),

  ('concrete_floor', 'Béton ciré au sol', 'micro-cement floor',
   '{floor}', '{"material_family": ["wood", "stone", "ceramic", "paint", "plastic"]}', 'area_m2', 'm²',
   '{"industriel": 0.9, "wabi-sabi": 0.85, "desert": 0.85, "cottage-anglais": -1, "haussmannien": -1}',
   '[{"name": "Kit béton ciré sol", "unit": "m²", "qty_formula": "area_m2"}, {"name": "Primaire d''accroche", "unit": "L", "qty_formula": "area_m2 * 0.15"}, {"name": "Vernis de protection", "unit": "L", "qty_formula": "area_m2 * 0.1"}]',
   false, true, 1, true),

  ('oil_wax_wood', 'Huiler / cirer le bois brut', 'oil or wax raw wood',
   '{coffee_table,side_table,dining_table,console_table,desk,sideboard,dresser,nightstand,bookshelf,shelf,bench}',
   '{"material_family": ["wood"]}', 'area_m2', 'L',
   '{"scandinave": 0.9, "japandi": 0.85, "wabi-sabi": 0.85}',
   '[{"name": "Huile dure ou cire", "unit": "L", "qty_formula": "area_m2 * 0.08"}, {"name": "Chiffons non pelucheux", "unit": "unité", "qty_formula": "2"}]',
   false, true, 1, true),

  ('strip_wood', 'Décaper et laisser brut', 'strip to raw wood',
   '{dresser,sideboard,wardrobe,nightstand,coffee_table,dining_table,desk,door,staircase}',
   '{"material_family": ["wood", "paint"]}', 'area_m2', 'L',
   '{"scandinave": 0.85, "wabi-sabi": 0.85, "boheme": 0.8}',
   '[{"name": "Décapant bois", "unit": "L", "qty_formula": "area_m2 * 0.25"}, {"name": "Papier abrasif (grains 80-180)", "unit": "unité", "qty_formula": "5"}, {"name": "Masque + gants", "unit": "unité", "qty_formula": "1"}]',
   false, true, 1, true),

  ('slat_front_furniture', 'Tasseaux sur façades (effet cannelé)', 'fluted slat furniture front',
   '{dresser,sideboard,tv_stand,cabinet,nightstand,wardrobe}',
   '{"material_family": ["wood", "paint"]}', 'area_m2', 'm²',
   '{"japandi": 0.9, "quiet-luxury": 0.85, "scandinave": 0.8, "memphis": -1, "cottage-anglais": -1}',
   '[{"name": "Tasseaux demi-rond", "unit": "unité", "qty_formula": "width_cm / 4"}, {"name": "Colle bois", "unit": "L", "qty_formula": "0.2"}, {"name": "Scie + boîte à onglet", "unit": "unité", "qty_formula": "1"}]',
   false, true, 1, true),

  ('cover_furniture_vinyl', 'Vinyle adhésif sur meuble', 'adhesive vinyl wrap',
   '{dresser,nightstand,tv_stand,sideboard,cabinet,wardrobe,bookshelf}',
   '{"material_family": ["wood", "metal", "plastic", "paint"]}', 'area_m2', 'm²',
   '{"wabi-sabi": -1, "quiet-luxury": -1}',
   '[{"name": "Vinyle adhésif", "unit": "m²", "qty_formula": "area_m2 * 1.3"}, {"name": "Raclette de marouflage", "unit": "unité", "qty_formula": "1"}, {"name": "Cutter", "unit": "unité", "qty_formula": "1"}]',
   false, true, 1, false),

  ('concrete_effect_top', 'Béton ciré / effet béton (plateau, meuble)', 'micro-cement furniture top',
   '{coffee_table,side_table,dining_table,console_table,sideboard,tv_stand}',
   '{"material_family": ["wood", "stone", "ceramic", "paint", "plastic"]}', 'area_m2', 'm²',
   '{"industriel": 0.9, "wabi-sabi": 0.85, "desert": 0.85, "cottage-anglais": -1, "haussmannien": -1}',
   '[{"name": "Kit béton ciré", "unit": "m²", "qty_formula": "area_m2"}, {"name": "Primaire d''accroche", "unit": "L", "qty_formula": "area_m2 * 0.1"}, {"name": "Lisseuse", "unit": "unité", "qty_formula": "1"}]',
   false, true, 1, true),

  ('recover_seat_pad', 'Recouvrir une galette d''assise', 'recover seat pad',
   '{chair,dining_chair,stool,bench}', '{}', 'area_m2', 'm²',
   '{}',
   '[{"name": "Tissu d''ameublement", "unit": "m²", "qty_formula": "area_m2 * 1.4"}, {"name": "Mousse", "unit": "m²", "qty_formula": "area_m2"}, {"name": "Agrafeuse + agrafes", "unit": "unité", "qty_formula": "1"}]',
   false, true, 2, false),

  ('slipcover_seat', 'Housse de canapé / fauteuil', 'sofa or armchair slipcover',
   '{sofa,armchair}', '{"material_family": ["fabric", "leather"]}', null, 'unité',
   '{}',
   '[{"name": "Housse extensible adaptée", "unit": "unité", "qty_formula": "1"}]',
   false, true, 1, false),

  ('fabric_headboard', 'Tête de lit tapissée (tissu tendu)', 'upholstered headboard',
   '{headboard,bed,wall}', '{}', 'area_m2', 'm²',
   '{"quiet-luxury": 0.9, "cottage-anglais": 0.85, "haussmannien": 0.8, "wabi-sabi": -1}',
   '[{"name": "Panneau bois/MDF", "unit": "m²", "qty_formula": "area_m2"}, {"name": "Mousse", "unit": "m²", "qty_formula": "area_m2"}, {"name": "Tissu", "unit": "m²", "qty_formula": "area_m2 * 1.4"}, {"name": "Agrafeuse + agrafes", "unit": "unité", "qty_formula": "1"}]',
   false, true, 2, false),

  ('swap_lampshade', 'Changer l''abat-jour', 'swap lampshade',
   '{table_lamp,floor_lamp,ceiling_light,wall_sconce}', '{}', null, 'unité',
   '{}',
   '[{"name": "Abat-jour", "unit": "unité", "qty_formula": "1"}]',
   false, true, 1, true),

  ('paint_lamp_base', 'Repeindre un pied de lampe', 'paint lamp base',
   '{table_lamp,floor_lamp}',
   '{"material_family": ["metal", "wood", "ceramic", "plastic", "paint"]}', null, 'unité',
   '{}',
   '[{"name": "Peinture spray", "unit": "unité", "qty_formula": "1"}, {"name": "Ruban de masquage", "unit": "unité", "qty_formula": "1"}]',
   false, true, 1, true),

  ('stair_riser_decor', 'Habiller les contremarches', 'stair riser decor',
   '{staircase}', '{}', null, 'unité',
   '{"mediterraneen": 0.9, "boheme": 0.8, "japandi": -1, "quiet-luxury": -1}',
   '[{"name": "Adhésifs contremarches", "unit": "unité", "qty_formula": "13"}, {"name": "Cutter", "unit": "unité", "qty_formula": "1"}]',
   false, true, 1, false),

  -- Dormantes : exigent le mécanisme de dérogation nominative (règle prompt
  -- « radiateur intouchable ») avant toute exposition, même beta.
  ('radiator_cover', 'Cache-radiateur', 'radiator cover',
   '{radiator}', '{}', null, 'unité',
   '{"industriel": -1}',
   '[{"name": "Kit cache-radiateur", "unit": "unité", "qty_formula": "1"}]',
   false, false, 1, false),

  ('paint_radiator', 'Repeindre le radiateur', 'paint radiator',
   '{radiator}', '{"material_family": ["metal", "paint"]}', null, 'L',
   '{}',
   '[{"name": "Peinture spéciale radiateur", "unit": "L", "qty_formula": "0.5"}, {"name": "Pinceau coudé", "unit": "unité", "qty_formula": "1"}]',
   false, false, 1, false)
on conflict do nothing;
