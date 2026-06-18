-- Taxonomie d'éléments DB-driven (E1).
-- Autorise la nouvelle catégorie d'asset `element_category` : source unique des
-- catégories que la détection (vision_detect_extended) peut émettre, hiérarchie
-- famille → type précis. Le prompt lit cette liste via {{categories}}.
--
-- Données seedées par scripts/seed-element-categories.mjs (44 types, 11 familles).

ALTER TABLE assets DROP CONSTRAINT assets_category_check;
ALTER TABLE assets ADD CONSTRAINT assets_category_check CHECK (
  category = ANY (ARRAY[
    'ambiance'::text,
    'room_defaults'::text,
    'floor_preset'::text,
    'wall_palette'::text,
    'standard_dims'::text,
    'element_category'::text
  ])
);
