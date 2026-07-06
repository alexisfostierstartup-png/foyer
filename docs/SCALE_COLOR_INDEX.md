# À reprendre plus tard — Index couleur pour le scaling du matching

> Statut : **analysé, PAS implémenté.** À faire quand le catalogue approche ~100k+ réfs.
> Inutile à l'échelle actuelle (~8,4k réfs → sous-ensembles par catégorie petits).
> **Coût : zéro re-embedding, zéro appel IA.** Purement du DDL + un backfill bon marché.

## Contexte

Le garde-fou couleur du matching (« un rendu bleu ne matche jamais du rouge ») est un
**pré-filtre par familles de couleur** dans la RPC `match_partner_products_blend_v2` :
le produit est exclu s'il a des `color_families` et qu'aucune ne recoupe celles du rendu.

Aujourd'hui (2026-07-06) ce filtre s'applique à **toutes** les catégories dès qu'on
connaît la couleur de l'élément (le bridage historique `color.weight ≥ 0,15` a été retiré —
il gouverne maintenant seulement le ranking fin, plus le garde-fou). Voir le commit
`fix(matching): garde-fou couleur élargi…`.

## Le problème à l'échelle

`color_families` vit dans le **jsonb `metadata->'attrs'->'color_families'`**, **non indexé**
(vérifié : aucun index dessus ; seuls `category` (btree), `embedding`/`text_embedding`
(ivfflat) le sont). La RPC `blend_v2` fait donc, par produit du sous-ensemble catégorie,
un `jsonb_array_elements_text(...)` (unnest) pour tester le recouvrement.

- **~8,4k réfs** : sous-ensembles par catégorie petits (quelques centaines/milliers) → coût négligeable. **Rien à faire.**
- **~300k réfs** : sous-ensembles catégorie de 10k-50k lignes → l'unnest jsonb par ligne devient un coût réel, ET l'ANN ivfflat avec un `WHERE` filtrant souffre du « filtered ANN » (scan de plus de listes pour trouver assez de matches post-filtre).

> Note : le **hex n'est jamais un filtre SQL** — le ΔE couleur fin se fait côté app sur
> le top-N déjà remonté. Le filtre DB est bien basé sur la **famille** ; il manque juste
> son **indexation**.

## Deux options (aucune ne touche aux embeddings)

### Option A — légère : index GIN sur le jsonb
```sql
CREATE INDEX idx_pp_color_families
  ON public.partner_products
  USING gin ((metadata->'attrs'->'color_families'));
```
Puis réécrire le `WHERE` de `match_partner_products_blend_v2` pour utiliser l'opérateur
de recouvrement `?|` (jsonb array ?| text[]) au lieu de `jsonb_array_elements_text(...) = any(...)` :
```sql
and (
  render_color_families is null
  or (p.metadata->'attrs'->'color_families') is null
  or (p.metadata->'attrs'->'color_families') ?| render_color_families
)
```
- Coût : build d'index (secondes), zéro changement de données, zéro re-embedding.
- Le `?|` peut exploiter le GIN → filtre couleur indexé.

### Option B — scale-ready : colonne indexée + composite
```sql
alter table public.partner_products add column color_families_arr text[];
-- backfill depuis le jsonb existant (un seul UPDATE, pas d'IA) :
update public.partner_products
set color_families_arr = array(
  select jsonb_array_elements_text(metadata->'attrs'->'color_families')
) where metadata->'attrs'->'color_families' is not null;

create index idx_pp_cat_colorfam
  on public.partner_products using gin (category, color_families_arr);
-- (ou un btree composite (category) + gin (color_families_arr) selon le plan d'exécution)
```
Puis la RPC filtre sur `color_families_arr && render_color_families` (recouvrement de tableaux
natifs, très rapide).
- Coût : build d'index + un `UPDATE` de backfill (bon marché même à 300k). Zéro IA.
- Rend le gate `color.weight ≥ 0,15` définitivement inutile (le garde-fou est cheap partout).
- À maintenir : peupler `color_families_arr` à l'ingestion (dans `ingestFromSource` / le sync).

## Recommandation

Faire **Option B** quand le catalogue dépasse ~100k réfs (ou si le matching ralentit avant).
Réversible (drop de colonne/index). Voir aussi `docs/OVERVIEW.md` §4 (matching) et
`docs/FOYER_LOGIC.md` §8.
