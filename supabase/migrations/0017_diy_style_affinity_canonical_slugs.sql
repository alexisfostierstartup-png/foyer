-- 0017 — Aligne diy_actions.style_affinity sur le set canonique de styles
-- (data/styles.json, 18 slugs). Additif : on ajoute les nouveaux slugs en
-- aliasant le score du style legacy/proche le plus pertinent ; les clés
-- existantes (dont legacy doux/brut/… et classique/minimaliste) sont conservées.
-- Un slug déjà présent sur une action n'est PAS écrasé.

update public.diy_actions
set style_affinity = jsonb_strip_nulls(jsonb_build_object(
      'boheme',          style_affinity->'bohemian',
      'boho',            style_affinity->'bohemian',
      'mid-century',     style_affinity->'vintage',
      'seventies',       style_affinity->'vintage',
      'memphis',         style_affinity->'vintage',
      'color-block',     style_affinity->'vintage',
      'wabi-sabi',       style_affinity->'doux',
      'japandi',         style_affinity->'minimaliste',
      'quiet-luxury',    style_affinity->'minimaliste',
      'haussmannien',    style_affinity->'classique',
      'art-deco',        style_affinity->'classique',
      'cottage-anglais', style_affinity->'classique',
      'dark-academia',   style_affinity->'classique',
      'desert',          style_affinity->'mediterraneen',
      'maximaliste',     style_affinity->'bohemian'
    )) || style_affinity
where style_affinity <> '{}'::jsonb;
