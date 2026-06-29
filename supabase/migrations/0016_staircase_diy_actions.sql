-- L'escalier (catégorie element_category "staircase", garder/customiser) est en
-- bois → on l'autorise aux deux actions DIY bois existantes pour que la review
-- propose un vrai "comment" sous Personnaliser (Repeindre / Teinter) plutôt qu'un
-- libellé vide ou "Conserver". Idempotent : on n'ajoute le slug que s'il manque.
update diy_actions
set applies_to_categories = array_append(applies_to_categories, 'staircase')
where slug in ('repaint', 'stain_wood')
  and not ('staircase' = any(applies_to_categories));
