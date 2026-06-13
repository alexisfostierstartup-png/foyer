-- ================================================================
-- α-12: DIY action library + element decisions
-- ================================================================

-- 1. Extend prompts.purpose constraint to include 'verdict'
alter table public.prompts drop constraint if exists prompts_purpose_check;
alter table public.prompts add constraint prompts_purpose_check
  check (purpose in ('generation', 'iteration', 'detection', 'audit', 'alterations', 'shopping', 'verdict'));

-- 2. Extend assets.category constraint to include 'standard_dims'
alter table public.assets drop constraint if exists assets_category_check;
alter table public.assets add constraint assets_category_check
  check (category in ('ambiance', 'room_defaults', 'floor_preset', 'wall_palette', 'standard_dims'));

-- 3. Table diy_actions — bibliothèque d'actions DIY
create table public.diy_actions (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  label text not null,
  label_en text,
  applies_to_categories text[] not null default '{}',
  requires jsonb not null default '{}'::jsonb,
  excludes jsonb not null default '{}'::jsonb,
  qty_formula text,
  qty_unit text,
  style_affinity jsonb not null default '{}'::jsonb,
  supplies_template jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_diy_actions_categories on public.diy_actions using gin(applies_to_categories);
alter table public.diy_actions enable row level security;
create policy "allow all v1" on public.diy_actions for all using (true) with check (true);
grant select, insert, update, delete on public.diy_actions to anon, authenticated;

-- 4. Alter Supabase projects table (symbolic – real storage is local JSON)
alter table public.projects add column if not exists element_decisions jsonb;

-- ================================================================
-- SEED : 15 actions DIY de départ
-- ================================================================
insert into public.diy_actions
  (slug, label, label_en, applies_to_categories, requires, excludes, qty_formula, qty_unit, style_affinity, supplies_template)
values

-- 1. Repeindre
('repaint', 'Repeindre', 'Repaint',
 array['wall','furniture','door','headboard','wardrobe'],
 '{"material_family":["wood","metal","paint","ceramic","plastic"]}'::jsonb,
 '{"material_family":["stone","glass","fabric"]}'::jsonb,
 'area_m2',
 'L',
 '{"doux":0.9,"brut":0.6,"bois-clair":0.7,"vintage":0.8,"mediterraneen":0.7,"bohemian":0.7,"scandinave":0.8,"industriel":0.5,"classique":0.7,"minimaliste":0.95}'::jsonb,
 '[{"name":"Peinture acrylique","qty_formula":"area_m2 * 0.1","unit":"L"},{"name":"Apprêt","qty_formula":"area_m2 * 0.08","unit":"L"},{"name":"Rouleau","qty_formula":"1","unit":"unité"}]'::jsonb),

-- 2. Papier peint
('wallpaper', 'Poser du papier peint', 'Apply wallpaper',
 array['wall'],
 '{}'::jsonb,
 '{"material_family":["stone","glass","fabric"]}'::jsonb,
 'area_m2 * 1.1',
 'm²',
 '{"doux":0.85,"brut":0.2,"bois-clair":0.4,"vintage":0.9,"mediterraneen":0.5,"bohemian":0.9,"scandinave":0.5,"industriel":0.2,"classique":0.8,"minimaliste":0.2}'::jsonb,
 '[{"name":"Papier peint","qty_formula":"area_m2 * 1.1","unit":"m²"},{"name":"Colle à papier peint","qty_formula":"area_m2 * 0.15","unit":"kg"}]'::jsonb),

-- 3. Moulures
('add_moldings', 'Ajouter des moulures', 'Add moldings',
 array['wall','door'],
 '{}'::jsonb,
 '{"material_family":["fabric","glass"]}'::jsonb,
 'length_m * 1.1',
 'ml',
 '{"doux":0.7,"brut":0.1,"bois-clair":0.5,"vintage":0.7,"mediterraneen":0.5,"bohemian":0.4,"scandinave":0.4,"industriel":0.1,"classique":0.95,"minimaliste":0.2}'::jsonb,
 '[{"name":"Moulure MDF","qty_formula":"length_m * 1.1","unit":"ml"},{"name":"Colle de montage","qty_formula":"length_m * 0.05","unit":"kg"}]'::jsonb),

-- 4. Teinte bois
('stain_wood', 'Teinter le bois', 'Stain wood',
 array['floor','furniture','door','shelf'],
 '{"material_family":["wood"]}'::jsonb,
 '{}'::jsonb,
 'area_m2 * 0.08',
 'L',
 '{"doux":0.6,"brut":0.85,"bois-clair":0.95,"vintage":0.75,"mediterraneen":0.5,"bohemian":0.65,"scandinave":0.9,"industriel":0.6,"classique":0.6,"minimaliste":0.7}'::jsonb,
 '[{"name":"Lasure / teinture bois","qty_formula":"area_m2 * 0.08","unit":"L"},{"name":"Papier de verre","qty_formula":"area_m2 * 0.5","unit":"feuille"}]'::jsonb),

-- 5. Retapisser
('reupholster', 'Retapisser', 'Reupholster',
 array['sofa','armchair','chair','bed','headboard','bench'],
 '{"material_family":["fabric","leather"]}'::jsonb,
 '{"material_family":["stone","ceramic","glass","metal"]}'::jsonb,
 'area_m2 * 1.15',
 'm²',
 '{"doux":0.9,"brut":0.3,"bois-clair":0.5,"vintage":0.9,"mediterraneen":0.7,"bohemian":0.85,"scandinave":0.6,"industriel":0.4,"classique":0.85,"minimaliste":0.5}'::jsonb,
 '[{"name":"Tissu de revêtement","qty_formula":"area_m2 * 1.15","unit":"m²"},{"name":"Ouate garnissage","qty_formula":"area_m2 * 0.2","unit":"kg"},{"name":"Agrafeuse tapissier","qty_formula":"1","unit":"unité"}]'::jsonb),

-- 6. Tête de lit lattes
('add_slat_headboard', 'Tête de lit en lattes de bois', 'Wood slat headboard',
 array['bed','wall'],
 '{}'::jsonb,
 '{}'::jsonb,
 'width_cm / 100 * height_cm / 100',
 'm²',
 '{"doux":0.6,"brut":0.7,"bois-clair":0.95,"vintage":0.5,"mediterraneen":0.4,"bohemian":0.7,"scandinave":0.9,"industriel":0.5,"classique":0.2,"minimaliste":0.75}'::jsonb,
 '[{"name":"Lattes de bois","qty_formula":"height_cm / 10","unit":"unité"},{"name":"Tasseau de fixation","qty_formula":"2","unit":"unité"},{"name":"Vis bois","qty_formula":"height_cm / 5","unit":"unité"}]'::jsonb),

-- 7. Poncer et vitrifier parquet
('refinish_floor', 'Poncer et vitrifier le parquet', 'Sand and varnish hardwood floor',
 array['floor'],
 '{"material_family":["wood"]}'::jsonb,
 '{}'::jsonb,
 'area_m2',
 'm²',
 '{"doux":0.7,"brut":0.8,"bois-clair":0.95,"vintage":0.7,"mediterraneen":0.4,"bohemian":0.5,"scandinave":0.9,"industriel":0.6,"classique":0.8,"minimaliste":0.8}'::jsonb,
 '[{"name":"Vitrificateur parquet","qty_formula":"area_m2 * 0.08","unit":"L"},{"name":"Location ponceuse","qty_formula":"1","unit":"jour"}]'::jsonb),

-- 8. Carrelage
('lay_tiles', 'Poser du carrelage', 'Lay tiles',
 array['floor','wall'],
 '{"material_family":["wood","stone","ceramic","paint","plastic"]}'::jsonb,
 '{"material_family":["fabric"]}'::jsonb,
 'area_m2 * 1.1',
 'm²',
 '{"doux":0.3,"brut":0.7,"bois-clair":0.3,"vintage":0.6,"mediterraneen":0.95,"bohemian":0.6,"scandinave":0.3,"industriel":0.7,"classique":0.7,"minimaliste":0.5}'::jsonb,
 '[{"name":"Carrelage","qty_formula":"area_m2 * 1.1","unit":"m²"},{"name":"Colle carrelage","qty_formula":"area_m2 * 4","unit":"kg"},{"name":"Joint","qty_formula":"area_m2 * 0.5","unit":"kg"}]'::jsonb),

-- 9. Lambris
('install_wainscoting', 'Poser des lambris', 'Install wainscoting',
 array['wall'],
 '{}'::jsonb,
 '{}'::jsonb,
 'area_m2 * 1.05',
 'm²',
 '{"doux":0.6,"brut":0.6,"bois-clair":0.9,"vintage":0.6,"mediterraneen":0.3,"bohemian":0.5,"scandinave":0.85,"industriel":0.4,"classique":0.65,"minimaliste":0.5}'::jsonb,
 '[{"name":"Lambris bois","qty_formula":"area_m2 * 1.05","unit":"m²"},{"name":"Colle de montage","qty_formula":"area_m2 * 0.3","unit":"kg"}]'::jsonb),

-- 10. Tringle à rideaux
('add_curtain_rail', 'Poser une tringle à rideaux', 'Install curtain rail',
 array['window','wall'],
 '{}'::jsonb,
 '{}'::jsonb,
 'width_cm / 100',
 'ml',
 '{"doux":0.85,"brut":0.4,"bois-clair":0.6,"vintage":0.7,"mediterraneen":0.6,"bohemian":0.8,"scandinave":0.7,"industriel":0.5,"classique":0.8,"minimaliste":0.6}'::jsonb,
 '[{"name":"Tringle à rideaux","qty_formula":"width_cm / 100","unit":"ml"},{"name":"Supports","qty_formula":"2","unit":"unité"},{"name":"Rideaux","qty_formula":"width_cm / 50","unit":"lé"}]'::jsonb),

-- 11. Pochoir / décoration
('stencil_decor', 'Décoration au pochoir', 'Stencil decoration',
 array['wall','furniture','door'],
 '{"material_family":["wood","paint","metal","plastic"]}'::jsonb,
 '{"material_family":["stone","glass"]}'::jsonb,
 'area_m2',
 'm²',
 '{"doux":0.5,"brut":0.3,"bois-clair":0.4,"vintage":0.8,"mediterraneen":0.75,"bohemian":0.9,"scandinave":0.3,"industriel":0.3,"classique":0.5,"minimaliste":0.2}'::jsonb,
 '[{"name":"Pochoir","qty_formula":"1","unit":"unité"},{"name":"Peinture acrylique","qty_formula":"area_m2 * 0.03","unit":"L"}]'::jsonb),

-- 12. Insert cannage
('add_cane_insert', 'Insérer du cannage', 'Add cane webbing insert',
 array['furniture','door','headboard','shelf'],
 '{"material_family":["wood"]}'::jsonb,
 '{"material_family":["fabric","metal","stone","glass","ceramic"]}'::jsonb,
 'area_m2',
 'm²',
 '{"doux":0.8,"brut":0.5,"bois-clair":0.7,"vintage":0.85,"mediterraneen":0.7,"bohemian":0.9,"scandinave":0.75,"industriel":0.2,"classique":0.6,"minimaliste":0.4}'::jsonb,
 '[{"name":"Cannage","qty_formula":"area_m2 * 1.2","unit":"m²"},{"name":"Colle bois","qty_formula":"area_m2 * 0.05","unit":"L"}]'::jsonb),

-- 13. Fresque / effet matière mural
('fresco_wall', 'Mur peint en effet matière', 'Textured wall effect',
 array['wall'],
 '{"material_family":["paint","ceramic","plastic"]}'::jsonb,
 '{}'::jsonb,
 'area_m2',
 'm²',
 '{"doux":0.7,"brut":0.8,"bois-clair":0.3,"vintage":0.6,"mediterraneen":0.8,"bohemian":0.85,"scandinave":0.3,"industriel":0.75,"classique":0.4,"minimaliste":0.5}'::jsonb,
 '[{"name":"Enduit à effet","qty_formula":"area_m2 * 1.5","unit":"kg"},{"name":"Spalter","qty_formula":"1","unit":"unité"}]'::jsonb),

-- 14. Changer les poignées / pieds
('replace_hardware', 'Changer les poignées et pieds', 'Replace hardware and legs',
 array['furniture','door','wardrobe','dresser'],
 '{"material_family":["wood","metal","paint","plastic"]}'::jsonb,
 '{"material_family":["fabric","stone","glass"]}'::jsonb,
 null,
 'unité',
 '{"doux":0.7,"brut":0.5,"bois-clair":0.7,"vintage":0.9,"mediterraneen":0.65,"bohemian":0.75,"scandinave":0.8,"industriel":0.6,"classique":0.85,"minimaliste":0.7}'::jsonb,
 '[{"name":"Poignées","qty_formula":"4","unit":"unité"},{"name":"Vis","qty_formula":"8","unit":"unité"}]'::jsonb),

-- 15. Adhésif imitation carrelage
('apply_adhesive_tiles', 'Poser des adhésifs imitation carrelage', 'Apply peel-and-stick tiles',
 array['floor','wall'],
 '{}'::jsonb,
 '{"material_family":["fabric","stone"]}'::jsonb,
 'area_m2 * 1.05',
 'm²',
 '{"doux":0.4,"brut":0.3,"bois-clair":0.4,"vintage":0.5,"mediterraneen":0.8,"bohemian":0.7,"scandinave":0.3,"industriel":0.4,"classique":0.4,"minimaliste":0.3}'::jsonb,
 '[{"name":"Adhésif carrelage","qty_formula":"area_m2 * 1.05","unit":"m²"}]'::jsonb);

-- ================================================================
-- SEED : standard_dims pour 12 catégories de mobilier
-- ================================================================
insert into public.assets (category, slug, data, sort_order) values
('standard_dims', 'sofa', '{"width_cm":220,"height_cm":85,"depth_cm":90,"area_m2":1.98}'::jsonb, 1),
('standard_dims', 'armchair', '{"width_cm":85,"height_cm":90,"depth_cm":80,"area_m2":0.68}'::jsonb, 2),
('standard_dims', 'coffee_table', '{"width_cm":120,"height_cm":45,"depth_cm":60,"area_m2":0.72}'::jsonb, 3),
('standard_dims', 'dining_table', '{"width_cm":160,"height_cm":75,"depth_cm":90,"area_m2":1.44}'::jsonb, 4),
('standard_dims', 'bed', '{"width_cm":160,"height_cm":120,"depth_cm":200,"area_m2":3.2}'::jsonb, 5),
('standard_dims', 'wardrobe', '{"width_cm":180,"height_cm":210,"depth_cm":60,"area_m2":1.08}'::jsonb, 6),
('standard_dims', 'dresser', '{"width_cm":100,"height_cm":80,"depth_cm":45,"area_m2":0.45}'::jsonb, 7),
('standard_dims', 'bookshelf', '{"width_cm":80,"height_cm":180,"depth_cm":30,"area_m2":0.24}'::jsonb, 8),
('standard_dims', 'tv_stand', '{"width_cm":150,"height_cm":50,"depth_cm":40,"area_m2":0.6}'::jsonb, 9),
('standard_dims', 'nightstand', '{"width_cm":50,"height_cm":55,"depth_cm":40,"area_m2":0.2}'::jsonb, 10),
('standard_dims', 'wall_standard', '{"area_m2":12,"length_m":3}'::jsonb, 11),
('standard_dims', 'floor_standard', '{"area_m2":20}'::jsonb, 12);

-- ================================================================
-- SEED : prompts
-- ================================================================

-- vision_detect_extended (v2 : ajoute material_family, surface_features, condition, dims)
insert into public.prompts (slug, purpose, conditions, template, provider, version, notes) values
('vision_detect_extended', 'detection', '{}'::jsonb,
$$Analyse cette photo de pièce intérieure avec précision.

Retourne UNIQUEMENT un JSON valide (sans texte avant/après) avec cette structure exacte :
{
  "elementProfiles": [
    {
      "element_id": "string (identifiant court unique, ex: sofa_1)",
      "element": "string (type en minuscules)",
      "category": "string (sofa|armchair|chair|bed|wardrobe|dresser|bookshelf|tv_stand|coffee_table|side_table|nightstand|shelf|floor|wall|ceiling|window|door|headboard|bench|rug|lamp|plant|other)",
      "description": "string (description concise en français)",
      "material_family": "wood|metal|fabric|stone|ceramic|glass|plastic|paint|unknown",
      "surface_features": ["painted","glossy","matte","textured","scratched","worn","stained","varnished","raw","upholstered","carved","lacquered"],
      "condition": "good|fair|poor",
      "movable": true|false,
      "dims": {
        "width_cm": number|null,
        "height_cm": number|null,
        "depth_cm": number|null,
        "area_m2": number|null,
        "length_m": number|null
      }
    }
  ],
  "qualityWarnings": []
}

Inclus tous les éléments visibles (meubles ET architecture : sol, murs, plafond, fenêtres).
Pour les surfaces architecturales (sol, murs), estime l'area_m2 visible.
Pour les meubles, estime width_cm et height_cm.
surface_features : liste uniquement les caractéristiques réellement visibles.
condition : good = bon état, fair = usé mais fonctionnel, poor = dégradé/endommagé.$$,
'gemini_vision', 1, 'Vision étendue α-12 : ajoute material_family, surface_features, condition, dims par élément'),

-- verdict_elements : décision groupée keep/customize/replace
('verdict_elements', 'verdict', '{}'::jsonb,
$$Tu es expert en décoration intérieure et DIY. Tu dois décider pour chaque élément de la pièce s'il faut le GARDER, le PERSONNALISER via DIY, ou le REMPLACER pour atteindre le style cible.

STYLE CIBLE : {{styleName}}
MOOD : {{styleMood}}

ÉLÉMENTS DÉTECTÉS :
{{elementsJson}}

ACTIONS DIY DISPONIBLES PAR ÉLÉMENT :
{{candidateActionsJson}}

RÈGLES STRICTES :
- mismatch_type "none" → conserver tel quel (déjà compatible avec le style)
- mismatch_type "surface" → personnaliser via DIY (couleur, tissu, quincaillerie — même structure)
- mismatch_type "structural" → remplacer (matériau ou structure fondamentalement incompatible)
- Ne propose "structural" que si aucune action DIY ne peut réconcilier l'élément avec le style
- Pour les éléments architecturaux (sol, murs), préfère "surface" avec l'action la plus adaptée
- action_slug DOIT être null si mismatch_type est "none" ou "structural"
- action_slug DOIT être un slug de la liste disponible si mismatch_type est "surface"

EXEMPLES :
Input : sofa en tissu gris, style "bohemian", actions disponibles : reupholster, stencil_decor
Output : {"element_id":"sofa_1","mismatch_type":"surface","action_slug":"reupholster","action_label":"Retapisser en tissu naturel"}

Input : armchair en métal chromé, style "doux", actions disponibles : repaint
Output : {"element_id":"arm_1","mismatch_type":"surface","action_slug":"repaint","action_label":"Repeindre en beige doux"}

Input : étagère en verre trempé, style "bois-clair", actions disponibles : []
Output : {"element_id":"shelf_1","mismatch_type":"structural","action_slug":null,"action_label":"Remplacer — le verre ne peut pas prendre l'aspect bois"}

Retourne UNIQUEMENT un JSON valide :
{
  "decisions": [
    {
      "element_id": "string",
      "mismatch_type": "none|surface|structural",
      "action_slug": "string|null",
      "action_label": "string (description courte de l'action, en français)"
    }
  ]
}$$,
'gemini_vision', 1, 'Verdict groupé α-12 : décide keep/customize/replace pour chaque élément');
