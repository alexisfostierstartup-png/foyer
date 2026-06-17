# Analyse approfondie — Flow & Prompts Foyer

> Lecture seule. Aucune modification de code/prompt/DB. Tests empiriques sur images de test
> uniquement (jamais sur tes vrais projets). Date : 2026-06-17.
>
> **Méthode :** réplique fidèle du provider vision de prod (`lib/ai/providers/geminiVision.ts` :
> SDK `@google/genai`, `gemini-2.5-flash-lite`, `temperature 0`, `mediaResolution HIGH`,
> pleine résolution). Script : `scripts/audit-vision.mjs` → résultats bruts dans
> `scripts/out/audit-vision-results.json` + `scripts/out/audit-vision.log`. Génération testée
> avec `gemini-2.5-flash-image` (rendu : `scripts/out/gen-origin-doux.png`). Deux agents de
> trace de code (bug review + taxonomie/shopping).
>
> Chaque finding est étiqueté **[PROUVÉ]** (preuve empirique ce jour), **[CODE]** (tracé dans
> le code, file:line), ou **[RAPPORTÉ]** (ton observation + analyse statique du prompt).

---

## 0. Verdict en une page

| # | Problème | Sévérité | Cause racine | Effort fix |
|---|----------|----------|--------------|-----------|
| B1 | Modifs de review jetées | 🔴 Critique | Piège des 2 boutons (UX) | 🟢 |
| C1 | Faux pos/neg analyse finale | 🔴 Critique | flash-lite trop faible + diff 2-photos | 🟡 |
| A3 | « TV » n'existe pas | 🟠 Majeur | Pas de catégorie `tv`/`television` | 🟡 |
| A2 | Catégories trop grossières | 🟠 Majeur | `table→coffee_table` codé en dur, pas de `dining_table` | 🟡 |
| A4 | Éléments identiques non fusionnés | 🟠 Majeur | Aucune logique de quantité nulle part | 🟡 |
| A1 | Sol sans couleur | 🟠 Majeur | Pas de champ `color` structuré | 🟢 |
| E1-4 | Taxonomie/shopping incohérents | 🟠 Majeur | 6 vocabulaires de catégories divergents | 🔴 |
| D1-7 | Défauts de génération | 🟡 Moyen | Règles absentes du prompt `gen_wow_generic` | 🟢/🟡 |
| C4 | 2 chemins finalize concurrents | 🟡 Moyen | Dette : ancien path mort jamais retiré | 🟢 |
| RED | Double détection analyze+generate | 🟡 Moyen | Vision non persistée/réutilisée | 🟡 |

🟢 = prompt/champ (rapide) · 🟡 = code+prompt+catalogue · 🔴 = refacto transverse

---

## 1. Le flow vivant & l'état des prompts

```
analyze  → vision_detect_extended + verdict_elements      (écran review)
generate → vision_detect (RE-détecte) + gen_wow_generic   (image)
iterate  → iterate_generic
final    → confirm_changes → shopping list (déterministe, sans LLM)
```

Prompts DB **vivants** : `vision_detect_extended`, `verdict_elements`, `vision_detect`,
`gen_wow_generic`, `iterate_generic`, `confirm_changes`, `extract_alterations` (vivant côté `/pro`
seulement). **Morts/à désactiver** : `gen_shopping_list`, `audit_application`, `audit_quality`,
`vision_analyze_full` (cf. analyse précédente).

---

## 2. Détection — « pas assez de précision »

### A1. Sol sans couleur — **[PROUVÉ]**
Le prompt `vision_detect_extended` met la couleur (si présente) dans la **description libre**, et la
matière dans `material_family`. Il n'y a **aucun champ `color` structuré**. Résultat sur 4 images :

| Image | Description sol renvoyée | Couleur captée ? |
|-------|--------------------------|------------------|
| origin | « dalles carrées **noires** » | ✅ |
| final | « parquet bois **clair** » | ✅ |
| landing/before | « parquet en bois avec un motif en chevrons » | ❌ **NON** |
| landing/after | « parquet en bois avec un motif en chevrons » | ❌ **NON** |

→ La couleur est **intermittente** (2/4) et jamais structurée. `material_family` reste `wood` que le
parquet soit blanc ou marron → **tu perds la trace** dès que tu changes la couleur sans changer la
matière. Exactement ton symptôme.

**Préco 🟢 :** ajouter aux `dims`/profil un champ `color` (+ éventuellement `color_hex`) **obligatoire**,
au moins pour `floor`/`wall`. Le rendre explicite dans le prompt (« décris TOUJOURS la couleur dominante »).
Le propager jusqu'à la décision et au diff pour tracer un changement de couleur à matière constante.

### A2. Catégories mobilier trop grossières — **[CODE]**
L'enum de détection (`supabase/migrations/0005_diy_actions.sql:229`) a `coffee_table` et `side_table`
mais **pas `dining_table`**. Pire : le mapping shopping force `table → coffee_table` en dur
(`lib/shopping/matcher.ts:25`, `lib/shopping/build.ts:29`). Donc table à manger, table basse et table
d'appoint finissent toutes en `coffee_table`. (Empiriquement, sur landing/before le modèle a *bien* su
distinguer `coffee_table` vs `side_table` quand les deux étaient visibles — le problème vient surtout du
**mapping en aval** et de l'**absence de `dining_table`**.)

**Préco 🟡 :** définir une **taxonomie canonique unique** (une seule source) et ajouter au minimum
`dining_table`, `dining_chair`, `tv`/`television`, `console`, `sideboard`. Aujourd'hui il y a
**6 listes de catégories divergentes** (cf. E1) → toute addition oblige à éditer 7 endroits.

### A3. « TV » n'existe pas — **[PROUVÉ + CODE]**
Sur `final.png` (qui a une vraie TV), la détection ne sort **que** `tv_stand` (« Meuble TV bas en bois
clair ») — **l'écran/téléviseur n'est jamais un élément**. Cause : pas de valeur `tv`/`television` dans
l'enum. En aval, une TV détectée tomberait en `other` → 0 action DIY → forcée `structural`
(`lib/ai/pipeline.ts:355-361`) → soit matchée à tort sur un produit `tv_stand` (on achète un meuble, pas
une télé), soit **droppée silencieusement** (`lib/shopping/build.ts:88-90`).

**Préco 🟡 :** ajouter `television`/`tv` à l'enum **et** au catalogue (un vrai produit TV), et décider
qu'une TV n'a jamais d'action DIY (toujours keep/replace). Lié à D4 (placement TV en génération).

### A4. Éléments identiques non fusionnés (quantité) — **[PROUVÉ + CODE]**
Sur landing/before la détection sort `bookshelf ×2`, `armchair ×2` comme éléments séparés ; sur
landing/after `sofa ×2`. **Aucune logique de quantité n'existe nulle part** : `ShoppingItem`
(`lib/types.ts:43-53`) et `CatalogEntry` n'ont **pas de champ `quantity`**. Les dédup se font par
`id` produit (`build.ts:86,94,112` ; `matcher.ts:135,149-153`) → 6 chaises identiques **collapsent en
1 ligne** (les 5 autres jetées, **compte perdu**) ou, si textes légèrement différents, **6 lignes
doublons**. Jamais « chaise ×6 ».

**Préco 🟡 :** introduire un `quantity` sur `ShoppingItem`+`CatalogEntry`, et au point de
dédup (`build.ts:88-126` / `matcher.ts:136-153`) **grouper par (catégorie, produit)** avec
`quantity = taille du groupe` et prix ×quantité. Fusionner au **niveau shopping**, pas détection (garder
la granularité par `element_id` pour l'audit).

### A5. Carrelage imitation bois pris pour du bois — **[RAPPORTÉ]**
Le prompt ne demande pas de distinguer « bois massif » vs « imitation/stratifié/carrelage effet bois ».
`material_family` n'a que `wood|ceramic|…` → un carrelage imitation bois sera classé `wood`, ce qui
ouvre à tort des actions DIY bois (poncer/teinter) impossibles sur du carrelage.

**Préco 🟢 :** ajouter une consigne explicite + un flag `finish_imitation: bool` (ou valeur
`ceramic_wood_look`). Question ouverte : visuellement c'est parfois indécidable — au moins baisser la
confiance et préférer `replace` plutôt qu'une action DIY bois.

### A6. Porte vitrée prise pour une fenêtre — **[RAPPORTÉ]**
L'enum a `window` ET `door` mais le prompt ne donne aucun critère de désambiguïsation (une porte-fenêtre
/ porte vitrée a une grande surface vitrée → classée `window`). Conséquence en génération : le modèle la
« redessine » comme une fenêtre (D3).

**Préco 🟢 :** consigne explicite « une surface vitrée allant jusqu'au sol = `door` (porte-fenêtre), pas
`window` » + marquer ces éléments `movable:false` / non modifiables.

### A7. Radiateur, applique → « other » (perdus)
Sur origin, 4 profils `other` (applique, radiateur…). Ces éléments built-in n'ont ni catégorie ni
traitement → ni préservés explicitement, ni achetables. Souvent ce sont des éléments à **préserver
absolument** (radiateur, applique câblée).

**Préco 🟢 :** catégories `radiator`, `sconce`/`wall_light`, marquées `movable:false` + règle de
préservation dure en génération.

---

## 3. Review — « les modifs ne semblent pas prises en compte »

> La chaîne technique de persistance **fonctionne** (PATCH `/decisions` → `element_decisions[].mismatch_type`
> → `formatDesignPlan` → `{{designPlan}}` de `gen_wow_generic`). Le problème est ailleurs, en 2 points :

### B1. Piège des deux boutons — **[CODE]** 🔴 *le vrai bug*
Dans `ReviewScreen.tsx`, après modification :
- le **gros bouton primaire** « Générer directement » (`:209-214`) appelle `handleGenerate(false)` →
  **saute le PATCH** → modifs **jetées** ;
- seul le bouton **secondaire** « Générer avec mes modifications » (`:215-222`, affiché si `hasOverrides`)
  appelle `handleGenerate(true)` et sauvegarde.

Le primaire reste affiché **au-dessus** même après édition, et le sous-titre dit « …ou générez
directement ». Un user qui édite puis tape le gros bouton perd tout, **silencieusement**. C'est très
probablement ce que tu observes.

**Préco 🟢 :** quand `hasOverrides`, le bouton primaire doit **inclure** les overrides (un seul bouton
« Générer » qui applique toujours les modifs en attente), ou désactiver/masquer « Générer directement ».

### B2. « Garder » ne produit aucune instruction — **[CODE]**
`formatDesignPlan` (`lib/prompts/helpers.ts:141-167`) n'émet de ligne que pour `surface` (RESTYLE) et
`structural` (REPLACE). Repasser un élément de customize/replace → **`none` (Garder)** ne génère **aucune**
ligne → repose uniquement sur l'ancrage par défaut du prompt, enforcement faible. (keep→customize/replace
marche bien, l'inverse est mou.)

**Préco 🟢 :** émettre une ligne explicite « PRESERVE this element exactly » pour les `none` qui étaient
overridés, au moins.

---

## 4. Analyse finale — faux positifs / faux négatifs (le cœur du sujet)

Test sur 2 paires avant/après (composite côte-à-côte, comme en prod), `extract_alterations` ×3 (flash-lite)
+ ×1 (flash) + `confirm_changes` (flash).

### C1. flash-lite vs flash : résultats radicalement différents — **[PROUVÉ]** 🔴
| Paire | flash-lite | flash | Écart |
|-------|-----------|-------|-------|
| origin→final (vide→meublé) | 11 alt, tout en **`replaced`** | 12 alt, tout en **`added`** + capte **TV** + **moulures** | actions opposées |
| before→after (restylage) | 11 alt (stable) | **17 alt** (dont des `removed` douteux) | +6, divergence majeure |

La prod fait `extract_alterations` en **flash-lite** mais `confirm_changes` en **flash** → **incohérence
de modèle** au sein du même flow. flash-lite **rate la TV** et **se trompe sur l'action** (added vs
replaced).

### C2. Les `action` ne sont pas fiables — **[PROUVÉ]**
Sur origin (pièce **vide**) → final, flash-lite étiquette tout `replaced` alors qu'il n'y avait **rien à
remplacer** (tout est `added`). Or `shoppingImpact` et la réconciliation dépendent de l'action. flash, lui,
met correctement `added`. → la distinction added/replaced via diff 2-photos est **non fiable en flash-lite**.

### C3. Cadrage/restaging différent → hallucinations de position — **[PROUVÉ]**
Sur before→after (deux photos au cadrage légèrement différent — cas identique à *original vs render*),
flash invente des `removed`/position : « Armchair (near window) removed », « Small bookshelf (right of
window) removed », « Side table (left of left sofa) removed »… Beaucoup sont des **faux positifs** dus au
changement d'angle, pas à un vrai retrait. Le modèle fort **sur-détecte** sur ce cas, le faible
**sous-détecte/mé-étiquette**. C'est la source directe de tes faux pos/neg.

### C4. Deux chemins finalize concurrents — **[CODE]**
- `extract_alterations` (diff libre, listant *tous* les changements) → **mort** côté `/create` (la fonction
  `extractAlterations` n'est plus appelée), encore vivant côté `/pro`.
- `confirm_changes` (vivant) part de l'**intention** (candidats customize/replace) et **gate par
  confirmation visuelle** → conçu pour réduire les faux positifs. **Mais** sa liste `additions` reste un
  diff libre : sur before→after il a listé `bookshelf`, `sofa` comme *ajouts* alors qu'ils **préexistaient**
  (juste restylés) → **faux positifs** dans les additions.
- Bon point : sur before→after, `confirm_changes` a correctement répondu `floor applied=false` et
  `wall applied=false` (rien changé) → la partie « gate sur intention » est **plus juste** que le diff libre.

**Préco 🟡 (la plus importante du doc) :**
1. **Unifier le modèle** : utiliser **flash** (pas flash-lite) pour toute l'analyse finale — l'écart
   de qualité est massif et c'est 1 appel.
2. **S'appuyer sur l'intention, pas le diff libre** : garder la logique `confirm_changes` (candidats →
   confirmation) et **restreindre les `additions`** aux éléments réellement absents de la détection
   d'origine (`element_id` connus), au lieu d'un diff visuel ouvert.
3. **Abandonner la distinction added/replaced par diff** : la déduire de l'intention (decision
   structural=replace, ajout net=added) plutôt que de la demander au modèle sur 2 photos.
4. Pour les ajouts nets, **ancrer sur la détection d'origine** : « est présent dans APRÈS ET absent de
   cette liste d'éléments d'origine » — supprime les faux ajouts d'éléments préexistants.

---

## 5. Génération (`gen_wow_generic`) — défauts image

> **[PROUVÉ]** la génération **fonctionne** (rendu en ~10 s, quota image gen débloqué). Sur une photo
> **paysage** d'une pièce vide, le rendu « doux » est **correct** : sol anthracite préservé, fenêtre +
> rideaux conservés, TV sur console au fond, échelle OK. Tes problèmes sont des **cas limites** liés à des
> **règles absentes du prompt**. Ci-dessous chaque point → où l'ajouter.

Le prompt actuel dit : ancrer les éléments détectés, préserver architecture/fenêtres/portes/cadrage,
ajouter ce qui manque. Il **ne contient pas** de règles pour :

| # | Problème [RAPPORTÉ] | Manque dans le prompt | Préco 🟢 |
|---|---------------------|------------------------|---------|
| D1 | Nouveaux points lumineux créés | Pas de règle « ne pas ajouter de point lumineux » | « N'ajoute jamais de nouveau point d'éclairage. Un luminaire suspendu **remplace** l'existant, à la **même position** » |
| D2 | Personnalise « derrière » la fenêtre | Pas d'interdiction sur l'extérieur | « Ne modifie jamais ce qui est visible **à travers** une fenêtre/porte vitrée (extérieur, pièce adjacente) » |
| D3 | Porte vitrée redessinée en fenêtre | Confusion porte/fenêtre (cf. A6) | Marquer porte-fenêtre `movable:false` + « préserve portes vitrées à l'identique » |
| D4 | Petite pièce : TV forcée n'importe où | `furnitureDefaults` impose une TV même sans place | Rendre la TV **conditionnelle** à la place/orientation : « n'ajoute une TV que si un mur adapté existe » |
| D5 | Échelle cassée en **portrait** | Pas de garde sur les proportions/format | « Respecte l'échelle réelle ; en cadrage portrait, ne sur-dimensionne pas le mobilier » + tester une normalisation d'orientation à l'upload |
| D6 | Canapé : tissu entièrement refait | « restyle finish » trop permissif | « Pour un canapé/fauteuil gardé : changer la couleur via **plaid/coussins** uniquement, ne pas re-tapisser » (= action niveau 1 vs niveau 2) |
| D7 | Parquet « teinté » proposé à tort | Pas de notion de coût/faisabilité | Teinter un parquet = poncer = **niveau 2 (remplacement/gros œuvre)**, pas une action surface ; à encoder côté DIY actions + prompt |

**Note ancrage :** le rendu test a **gardé le carrelage anthracite** (sol absent du designPlan) → l'ancrage
est **fort**, parfois trop : sans choix explicite de changer le sol, il ne change jamais. À garder en tête
pour l'UX (proposer le changement de sol explicitement).

---

## 6. Taxonomie & shopping — dette structurelle (**[CODE]**)

### E1. Six vocabulaires de catégories divergents
1. enum détection `vision_detect_extended` (23 valeurs, `0005_diy_actions.sql:229`)
2. enum `extract_alterations` (différent, ouvert « etc. », `seed.ts:125`)
3. `applies_to_categories` des DIY actions (référence `furniture`, jamais émis par la détection !)
4. `standard_dims` slugs (contient déjà `dining_table` que personne d'autre ne produit, `:204`)
5. `CatalogCategory` TS (19 valeurs, `catalog.ts`)
6. `VALID_CATEGORIES` **dupliqué** dans `matcher.ts:42` **et** `build.ts:36`

Aucune source partagée → drift déjà présent. Ajouter une catégorie = éditer **7 endroits**.

### E2. Catégories non couvertes par le catalogue → drop silencieux
Sur 23 valeurs de l'enum détection, **~9 seulement** résolvent vers un vrai produit
(`sofa, armchair, coffee_table, tv_stand, bookshelf, bed, nightstand, rug, lamp, plant`). `chair`,
`wardrobe`, `dresser`, `shelf`, `side_table`, `headboard`, `bench`… → **aucun produit** → l'élément
**disparaît** de la shopping list sans trace (`build.ts:88-90`). Incohérence : le chemin `build` **drop**,
le chemin `matcher` **garde un placeholder à 0 €** → les deux chemins ne traitent pas pareil l'inconnu.

### E3. Pas de quantité (cf. A4).
### E4. Deux chemins shopping (`build` via décisions, `matcher` via alterations) avec normalisation de
catégorie **dupliquée et divergente**.

**Préco 🔴 :** une **seule** source de taxonomie (TS const partagée + génération du fragment d'enum
injecté dans les prompts), un **seul** chemin shopping, `quantity` de bout en bout, et un **fallback
visible** (placeholder « non matché ») au lieu du drop silencieux.

---

## 7. Redondances & dette à nettoyer

- **Double détection** : `analyze` lance `vision_detect_extended`, puis `generate` relance
  `vision_detect` (la sortie d'analyze n'est pas persistée pour le gen → 1 appel Vision payé en double).
  **Préco 🟡** : persister un `visionOutput` réutilisable dès analyze, ou fusionner les deux prompts.
- **Prompts morts** : `gen_shopping_list` (actif mais orphelin), `audit_application`, `audit_quality`,
  `vision_analyze_full` (cf. analyse précédente — tu les passes en désactivé).
- **Fonctions mortes** : `extractAlterations`, `matchAndSaveShoppingList`, `runFullFinalizePipeline`,
  `runApplicationAudit` (aucun appelant).
- **Seed périmé** : `supabase/seed/seed.ts` ne reflète plus la DB (5/11 slugs).

---

## 8. Nouvelles features demandées (à cadrer plus tard)

- **« Autre disposition »** : générer la même pièce en 3 agencements différents. Faisable via 3 appels
  `gen_wow_generic` avec une consigne d'agencement variée (et `temperature` > 0 ou seeds différents). À
  designer comme un mode « variations ».
- **Salon + salle à manger** : `roomType` actuel = `salon|chambre`. Ajouter `salon_sam` avec un
  `room_defaults` dédié (table à manger + chaises + buffet) — dépend de A2/E1 (catégories
  `dining_table`/`dining_chair`).

---

## 9. Ordre de bataille suggéré (à toi de trancher point par point)

**Lot 1 — Quick wins (🟢, fort impact) :**
- B1 bouton review · A1 champ `color` · B2 ligne « preserve » · D1/D2/D3/D6/D7 règles prompt génération.

**Lot 2 — Analyse finale (🟡, ton point n°1) :**
- C1 passer en flash · C4 unifier sur la logique intention + restreindre les additions · supprimer la
  dépendance added/replaced au diff.

**Lot 3 — Taxonomie & shopping (🔴, structurant) :**
- E1 source unique de catégories · A2 `dining_table` · A3 `tv` · A4 quantité · E2 fallback visible.

**Lot 4 — Dette & features :**
- double détection · nettoyage prompts/fonctions morts · features (variations, salon+SAM).
